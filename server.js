const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { getOperatorReliable } = require('./services/lookupService');
const RateLimiter = require('./services/rateLimiter');
const { Logger, PortingService, SpamService, NumberInfoService, AnalyticsService } = require('./services/advancedServices');
const db = require('./config/db');
const veriphoneService = require('./services/vonageservice'); // <-- Importación añadida

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ==================== MIDDLEWARE ====================
const generalLimiter = RateLimiter.limitByIP(15 * 60 * 1000, 100);
app.use('/api/lookup', generalLimiter);
app.use('/api/number-info', generalLimiter);
app.use('/api/porting', generalLimiter);
app.use('/api/spam-check', generalLimiter);

const authenticateAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};

// ==================== ENDPOINTS PÚBLICOS ====================
app.get('/api/lookup/:number', async (req, res) => {
    const result = await getOperatorReliable(req.params.number, req.ip);
    if (result.success) res.json(result);
    else res.status(result.warning ? 200 : 503).json(result);
});

app.get('/api/number-info/:number', async (req, res) => {
    res.json(await NumberInfoService.getFullInfo(req.params.number));
});

app.get('/api/porting/:number', async (req, res) => {
    res.json(await PortingService.checkPorting(req.params.number));
});

app.get('/api/public/stats', async (req, res) => {
    try {
        const [[totalSearches]] = await db.query('SELECT COUNT(*) as count FROM search_history');
        const [[successSearches]] = await db.query('SELECT COUNT(*) as count FROM search_history WHERE operator_found IS NOT NULL');
        const [[operatorCount]] = await db.query('SELECT COUNT(DISTINCT operator_name) as count FROM numero_ranges WHERE operator_name IS NOT NULL');
        const [[avgTime]] = await db.query('SELECT AVG(response_time_ms) as avg FROM search_history WHERE response_time_ms > 0');
        const [topOperators] = await db.query(
            `SELECT operator_found, COUNT(*) as search_count FROM search_history WHERE operator_found IS NOT NULL GROUP BY operator_found ORDER BY search_count DESC LIMIT 10`
        );
        res.json({
            total_searches: parseInt(totalSearches?.count) || 0,
            successful_searches: parseInt(successSearches?.count) || 0,
            operator_count: parseInt(operatorCount?.count) || 0,
            average_response_time: parseFloat(avgTime?.avg) || 0,
            top_operators: topOperators || []
        });
    } catch (err) {
        console.error('Public stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/spam-check/:number', async (req, res) => {
    res.json(await SpamService.checkSpam(req.params.number));
});

app.post('/api/public/porting/report', async (req, res) => {
    try {
        const { phoneNumber, currentOperator, newOperator } = req.body;
        if (!phoneNumber || !newOperator) return res.status(400).json({ error: 'Faltan campos requeridos' });
        if (!/^34\d{9}$/.test(phoneNumber)) return res.status(400).json({ error: 'Formato de número inválido' });

        const phoneNum = BigInt(phoneNumber.substring(2));
        const [ranges] = await db.query('SELECT * FROM numero_ranges WHERE range_start <= ? AND range_end >= ? LIMIT 1', [phoneNum, phoneNum]);

        if (ranges && ranges.length > 0) {
            const range = ranges[0];
            await db.query('UPDATE numero_ranges SET operator_name = ? WHERE id = ?', [newOperator, range.id]);
            try {
                await db.query(`INSERT INTO operators_cache (phone_number, operator_name, nrn) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE operator_name = VALUES(operator_name), nrn = VALUES(nrn)`, [phoneNumber, newOperator, range.nrn]);
            } catch (cacheErr) { console.log('Cache update warning:', cacheErr.message); }
        }
        await db.query('INSERT INTO ported_numbers (phone_number, original_operator, current_operator, ported_date) VALUES (?, ?, ?, NOW())', [phoneNumber, currentOperator || 'Desconocido', newOperator]);
        await Logger.log('PUBLIC_PORTING_REPORTED', { phoneNumber, from: currentOperator, to: newOperator, ip: req.ip });
        res.json({ success: true, message: `Portabilidad registrada: ${phoneNumber} → ${newOperator}` });
    } catch (err) {
        console.error('Public porting error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Vonage público
app.get('/api/vonage/verify/:number', async (req, res) => {
    try {
        const VonageService = require('./services/vonageService');
        if (!VonageService.enabled) return res.status(400).json({ error: 'Vonage no configurado' });
        const phoneNumber = req.params.number;
        if (!/^34\d{9}$/.test(phoneNumber)) return res.status(400).json({ error: 'Formato inválido (34XXXXXXXXX)' });
        const result = await VonageService.verifyNumber(phoneNumber);
        if (result.error) return res.status(400).json(result);
        await Logger.log('VONAGE_VERIFY', { phoneNumber, carrierName: result.carrierName, numberType: result.numberType });
        res.json(result);
    } catch (err) {
        console.error('Vonage verify error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vonage/compare/:number/:dbOperator', async (req, res) => {
    try {
        const VonageService = require('./services/vonageService');
        if (!VonageService.enabled) return res.status(400).json({ error: 'Vonage no configurado' });
        const { number, dbOperator } = req.params;
        const comparison = await VonageService.compareWithDatabase(number, decodeURIComponent(dbOperator));
        res.json(comparison);
    } catch (err) {
        console.error('Vonage compare error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== AUTENTICACIÓN ====================
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        await Logger.log('LOGIN_FAILED', { ip: req.ip });
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    try {
        const token = jwt.sign({ admin: true, loginTime: new Date() }, JWT_SECRET, { expiresIn: '24h' });
        await Logger.log('LOGIN_SUCCESS', { ip: req.ip });
        res.json({ token, message: 'Autenticación exitosa' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/verify', authenticateAdmin, (req, res) => {
    res.json({ valid: true, admin: req.admin });
});

// ==================== ENDPOINTS ADMIN ====================
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const stats = await AnalyticsService.getStats(7);
        const total = stats.reduce((sum, s) => sum + (s.total_searches || 0), 0);
        const successful = stats.reduce((sum, s) => sum + (s.successful || 0), 0);
        const failed = stats.reduce((sum, s) => sum + (s.failed || 0), 0);
        const avgTime = Math.round(stats.reduce((sum, s) => sum + (s.avg_response_time || 0), 0) / (stats.length || 1));

        let operatorStats = await AnalyticsService.getOperatorStats();
        operatorStats = operatorStats.map(op => ({
            operator_found: op.operator || op.operator_found || 'Desconocido',
            total_searches: parseInt(op.searches || op.total_searches || 0),
            successful: parseInt(op.successful || 0),
            avg_response_time: parseFloat(op.avg_response_time || 0)
        }));
        const topNumbers = await AnalyticsService.getMostSearched(10);
        res.json({ total, successful, failed, avg_time: avgTime, by_operator: operatorStats || [], top_numbers: topNumbers || [] });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message, total: 0, successful: 0, failed: 0, avg_time: 0, by_operator: [], top_numbers: [] });
    }
});

app.get('/api/admin/portings', authenticateAdmin, async (req, res) => {
    try {
        const [portings] = await db.query('SELECT * FROM ported_numbers ORDER BY ported_date DESC LIMIT 50');
        res.json(portings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/porting/update', authenticateAdmin, async (req, res) => {
    try {
        const { phoneNumber, currentOperator, newOperator } = req.body;
        if (!phoneNumber || !newOperator) return res.status(400).json({ error: 'Faltan campos requeridos' });

        const phoneNum = BigInt(phoneNumber);
        const [ranges] = await db.query('SELECT * FROM numero_ranges WHERE range_start <= ? AND range_end >= ? LIMIT 1', [phoneNum, phoneNum]);
        if (!ranges || ranges.length === 0) return res.status(404).json({ error: 'Número no encontrado en rango' });

        const range = ranges[0];
        await db.query('UPDATE numero_ranges SET operator_name = ? WHERE id = ?', [newOperator, range.id]);

        try {
            const [cacheEntry] = await db.query('SELECT id FROM operators_cache WHERE phone_number = ?', [phoneNumber]);
            if (cacheEntry && cacheEntry.length > 0) {
                await db.query('UPDATE operators_cache SET operator_name = ? WHERE phone_number = ?', [newOperator, phoneNumber]);
            }
        } catch (cacheErr) { console.log('Cache update warning:', cacheErr.message); }

        await db.query('INSERT INTO ported_numbers (phone_number, original_operator, current_operator, ported_date) VALUES (?, ?, ?, NOW())', [phoneNumber, currentOperator || range.operator_name, newOperator]);
        await Logger.log('PORTING_UPDATED', { phoneNumber, from: range.operator_name, to: newOperator, admin: req.admin });
        res.json({ success: true, message: `Operador actualizado: ${phoneNumber} → ${newOperator}`, updated: { phoneNumber, newOperator } });
    } catch (err) { console.error('Error updating porting:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/porting/:id', authenticateAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM ported_numbers WHERE id = ?', [req.params.id]);
        await Logger.log('PORTING_DELETED', { portingId: req.params.id });
        res.json({ success: true, message: 'Portabilidad eliminada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/porting/report', authenticateAdmin, async (req, res) => {
    try {
        const { number, from, to } = req.body;
        const result = await PortingService.reportPorting(number, from, to);
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/spam', authenticateAdmin, async (req, res) => {
    try {
        const [spam] = await db.query('SELECT * FROM spam_numbers WHERE spam_score > 0 ORDER BY spam_score DESC LIMIT 50');
        res.json(spam);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/spam/report', authenticateAdmin, async (req, res) => {
    try {
        const { number, category } = req.body;
        const result = await SpamService.reportSpam(number, category, 'ADMIN');
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Gestión de números
app.post('/api/admin/numbers/import-csv', authenticateAdmin, async (req, res) => {
    try {
        const { csv } = req.body;
        const lines = csv.split('\n').filter(line => line.trim() && !line.startsWith('phone_number'));
        let imported = 0, failed = 0;
        for (const line of lines) {
            try {
                const [phone, operator, nrn, type] = line.split(',').map(v => v.trim());
                if (!phone || !operator) continue;
                if (!/^34\d{9}$/.test(phone)) { failed++; continue; }
                const phoneNum = BigInt(phone.substring(2));
                await db.query(`INSERT IGNORE INTO numero_ranges (range_start, range_end, operator_name, nrn, type) VALUES (?, ?, ?, ?, ?)`, [phoneNum, phoneNum, operator, nrn || null, type || 'MOBILE']);
                imported++;
            } catch (lineErr) { failed++; }
        }
        await Logger.log('CSV_IMPORTED', { imported, failed });
        res.json({ success: true, imported, failed, message: `${imported} números importados, ${failed} fallidos` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/numbers/add', authenticateAdmin, async (req, res) => {
    try {
        const { phone_number, operator_name, type } = req.body;
        if (!phone_number || !operator_name) return res.status(400).json({ error: 'Faltan campos requeridos' });
        if (!/^34\d{9}$/.test(phone_number)) return res.status(400).json({ error: 'Formato de número inválido' });
        const phoneNum = BigInt(phone_number.substring(2));
        const result = await db.query(`INSERT INTO numero_ranges (range_start, range_end, operator_name, type) VALUES (?, ?, ?, ?)`, [phoneNum, phoneNum, operator_name, type || 'MOBILE']);
        await Logger.log('NUMBER_ADDED', { phone_number, operator_name, admin: req.admin });
        res.json({ success: true, message: `Número ${phone_number} agregado exitosamente`, id: result[0].insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/numbers/recent', authenticateAdmin, async (req, res) => {
    try {
        const [numbers] = await db.query(`SELECT range_start as phone_number, operator_name, type, created_at FROM numero_ranges ORDER BY created_at DESC LIMIT 50`);
        res.json(numbers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Logs, API Keys
app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
    try {
        const [logs] = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/keys', authenticateAdmin, async (req, res) => {
    try {
        const [keys] = await db.query('SELECT id, api_key, user_name, is_active, requests_limit, requests_used, created_at FROM api_keys ORDER BY created_at DESC');
        res.json(keys);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/keys/create', authenticateAdmin, async (req, res) => {
    try {
        const { userName, requestsLimit } = req.body;
        const apiKey = 'sk_' + require('crypto').randomBytes(32).toString('hex');
        await db.query('INSERT INTO api_keys (api_key, user_name, requests_limit) VALUES (?, ?, ?)', [apiKey, userName || 'Sin nombre', requestsLimit || 10000]);
        await Logger.log('API_KEY_CREATED', { userName });
        res.json({ success: true, apiKey, message: 'API Key creada exitosamente' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/keys/:id', authenticateAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM api_keys WHERE id = ?', [req.params.id]);
        await Logger.log('API_KEY_DELETED', { keyId: req.params.id });
        res.json({ success: true, message: 'API Key eliminada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/admin/keys/:id/toggle', authenticateAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;
        await db.query('UPDATE api_keys SET is_active = ? WHERE id = ?', [isActive, req.params.id]);
        await Logger.log('API_KEY_TOGGLED', { keyId: req.params.id, active: isActive });
        res.json({ success: true, message: `API Key ${isActive ? 'activada' : 'desactivada'}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== BULK LOOKUP (SOLO VERIPHONE, SIN RANGOS LOCALES) ====================
app.post('/api/admin/bulk-lookup', authenticateAdmin, async (req, res) => {
    try {
        const { numbers } = req.body;
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Array de números requerido' });
        }

        console.log(`[BULK] Procesando ${numbers.length} números con Veriphone (ultra-rápido)...`);

        // Normalizar todos los números
        const cleanNumbers = numbers.map(raw => {
            let cleaned = raw.replace(/\D/g, '');
            if (!cleaned.startsWith('34')) cleaned = '34' + cleaned;
            return cleaned;
        });

        // 1. Obtener los que ya están en veriphone_cache (válidos por 7 días según tu servicio)
        const placeholders = cleanNumbers.map(() => '?').join(',');
        const [cachedRows] = await db.query(
            `SELECT phone_number, carrier_name, number_type, phone_valid 
             FROM veriphone_cache 
             WHERE phone_number IN (${placeholders}) 
               AND last_checked >= NOW() - INTERVAL 7 DAY`,
            cleanNumbers
        );

        // Convertir a mapa para acceso rápido
        const cacheMap = new Map();
        for (const row of cachedRows) {
            cacheMap.set(row.phone_number, {
                operator: row.carrier_name,
                type: row.number_type || 'MOBILE',
                valid: row.phone_valid
            });
        }

        const results = [];
        const pendingNumbers = []; // números que no están en caché y necesitan API

        for (const num of cleanNumbers) {
            if (cacheMap.has(num)) {
                const c = cacheMap.get(num);
                results.push({
                    number: num,
                    operator: c.operator,
                    success: c.valid,
                    type: c.type,
                    ported: false
                });
            } else {
                pendingNumbers.push(num);
            }
        }

        console.log(`[BULK] Caché local: ${cacheMap.size} encontrados, ${pendingNumbers.length} pendientes de API`);

        // 2. Procesar los pendientes con concurrencia alta (usa 25 para plan enterprise)
        const CONCURRENCY = 25;

        async function processSingle(num) {
            const intlNumber = '+' + num;
            if (!veriphoneService.enabled) {
                return { number: num, operator: 'API no configurada', success: false, type: 'N/A', ported: false };
            }
            try {
                const verResult = await veriphoneService.verifyNumber(intlNumber);
                if (verResult.success && verResult.carrierName) {
                    return {
                        number: num,
                        operator: verResult.carrierName,
                        success: true,
                        type: verResult.numberType || 'MOBILE',
                        ported: false
                    };
                } else {
                    return { number: num, operator: 'No encontrado', success: false, type: 'N/A', ported: false };
                }
            } catch (err) {
                console.error(`[BULK] Error con ${num}:`, err.message);
                return { number: num, operator: 'Error', success: false, type: 'N/A', ported: false };
            }
        }

        for (let i = 0; i < pendingNumbers.length; i += CONCURRENCY) {
            const batch = pendingNumbers.slice(i, i + CONCURRENCY);
            const batchPromises = batch.map(n => processSingle(n));
            const batchResults = await Promise.allSettled(batchPromises);

            for (const res of batchResults) {
                if (res.status === 'fulfilled') {
                    results.push(res.value);
                } else {
                    console.error('[BULK] Promise rechazada:', res.reason);
                }
            }
        }

        console.log(`[BULK] Finalizado. Éxitos: ${results.filter(r => r.success).length}, Fallos: ${results.filter(r => !r.success).length}`);
        res.json({ success: true, results });

    } catch (err) {
        console.error('[BULK] Error general:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/numbers/generate', authenticateAdmin, async (req, res) => {
    try {
        const { quantity, operator_name, type } = req.body;
        const prefijos = { 'Movistar': ['600','610','620','660'], 'Vodafone': ['607','617','657'], 'Orange': ['650','651','655'], 'Yoigo': ['622','633'], 'Digi': ['722'] };
        const listaPrefijos = prefijos[operator_name] || ['600'];
        const values = [];
        for (let i = 0; i < quantity; i++) {
            const pre = listaPrefijos[Math.floor(Math.random() * listaPrefijos.length)];
            const sufijo = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            values.push([BigInt(pre + sufijo), BigInt(pre + sufijo), operator_name, type || 'MOBILE']);
        }
        await db.query(`INSERT IGNORE INTO numero_ranges (range_start, range_end, operator_name, type) VALUES ?`, [values]);
        res.json({ success: true, message: `${quantity} números generados para ${operator_name}` });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Fallo al generar el lote masivo.' }); }
});

// ==================== VERIPHONE (VONAGE) EN PANEL ADMIN ====================
app.get('/api/admin/vonage/verify', authenticateAdmin, async (req, res) => {
    try {
        const { number } = req.query;
        if (!number) return res.status(400).json({ error: 'Falta el parámetro number' });

        const result = await veriphoneService.verifyNumber(number);
        return res.json(result);
    } catch (err) {
        console.error('Error en /api/admin/vonage/verify:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/admin/vonage/compare', authenticateAdmin, async (req, res) => {
    try {
        const { number, operator } = req.body;
        if (!number || !operator) return res.status(400).json({ error: 'Faltan number u operator' });

        const result = await veriphoneService.compareWithDatabase(number, operator);
        return res.json(result);
    } catch (err) {
        console.error('Error en /api/admin/vonage/compare:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== HEALTH CHECK Y 404 ====================
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.post('/api/expandir-cabeceras', async (req, res) => {
    const { cabeceras, cantidadPorCabecera } = req.body;
    let todosLosNumeros = new Set();
    try {
        for (let seed of cabeceras) {
            const cleanSeed = seed.startsWith('34') ? seed.substring(2) : seed;
            const [rangos] = await db.query("SELECT range_start as inicio, range_end as fin FROM numero_ranges WHERE ? BETWEEN range_start AND range_end LIMIT 1", [BigInt(cleanSeed)]);
            if (rangos.length > 0) {
                const inicio = BigInt(rangos[0].inicio);
                const fin = BigInt(rangos[0].fin);
                const rangoSize = Number(fin - inicio);
                let intentos = 0, maxIntentos = cantidadPorCabecera * 2, generados = 0;
                while (generados < cantidadPorCabecera && intentos < maxIntentos) {
                    const nuevoNum = inicio + BigInt(Math.floor(Math.random() * (rangoSize + 1)));
                    const numString = nuevoNum.toString();
                    if (!todosLosNumeros.has(numString)) {
                        todosLosNumeros.add(numString);
                        generados++;
                    }
                    intentos++;
                }
            }
        }
        res.json({ success: true, numeros: Array.from(todosLosNumeros), total: todosLosNumeros.size });
    } catch (error) {
        console.error('Error en expansión:', error);
        res.status(500).json({ error: error.message });
    }
});

app.use((req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║    🚀 Telco Lookup Server Activo                         ║        
╠══════════════════════════════════════════════════════════╣
║  🌐 Web: http://localhost:${PORT}/                       ║
║  🔐 Login: http://localhost:${PORT}/admin-login.html     ║
║  🔧 API: http://localhost:${PORT}/api/health             ║
║  📊 Dashboard: http://localhost:${PORT}/admin.html       ║
╚══════════════════════════════════════════════════════════╝
    `);
    Logger.log('SERVER_STARTED', { port: PORT });
});