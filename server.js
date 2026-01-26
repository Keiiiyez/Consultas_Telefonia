const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { getOperatorReliable } = require('./services/lookupService');
const RateLimiter = require('./services/rateLimiter');
const { Logger, PortingService, SpamService, NumberInfoService, AnalyticsService } = require('./services/advancedServices');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ==================== MIDDLEWARE ====================

// Rate limiting para API pública
const generalLimiter = RateLimiter.limitByIP(15 * 60 * 1000, 100);
app.use('/api/lookup', generalLimiter);
app.use('/api/number-info', generalLimiter);
app.use('/api/porting', generalLimiter);
app.use('/api/spam-check', generalLimiter);

// Middleware de autenticación JWT
const authenticateAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};

// ==================== ENDPOINTS PÚBLICOS ====================

// Búsqueda de operador
app.get('/api/lookup/:number', async (req, res) => {
    const result = await getOperatorReliable(req.params.number, req.ip);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(result.warning ? 200 : 503).json(result);
    }
});

// Información del número
app.get('/api/number-info/:number', async (req, res) => {
    const info = await NumberInfoService.getFullInfo(req.params.number);
    res.json(info);
});

// Verificar portabilidad
app.get('/api/porting/:number', async (req, res) => {
    const porting = await PortingService.checkPorting(req.params.number);
    res.json(porting);
});

// Estadísticas públicas (sin autenticación)
app.get('/api/public/stats', async (req, res) => {
    try {
        const db = require('./config/db');
        
        // Total de búsquedas
        const [[totalSearches]] = await db.query(
            'SELECT COUNT(*) as count FROM search_history'
        );
        
        // Búsquedas exitosas
        const [[successSearches]] = await db.query(
            'SELECT COUNT(*) as count FROM search_history WHERE operator_found IS NOT NULL'
        );
        
        // Operadores únicos
        const [[operatorCount]] = await db.query(
            'SELECT COUNT(DISTINCT operator_name) as count FROM numero_ranges WHERE operator_name IS NOT NULL'
        );
        
        // Tiempo promedio
        const [[avgTime]] = await db.query(
            'SELECT AVG(response_time_ms) as avg FROM search_history WHERE response_time_ms > 0'
        );

        // Top operadores
        const [topOperators] = await db.query(
            `SELECT operator_found, COUNT(*) as search_count 
             FROM search_history 
             WHERE operator_found IS NOT NULL
             GROUP BY operator_found 
             ORDER BY search_count DESC 
             LIMIT 10`
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

// Verificar spam
app.get('/api/spam-check/:number', async (req, res) => {
    const spam = await SpamService.checkSpam(req.params.number);
    res.json(spam);
});

// Reportar portabilidad (público)
app.post('/api/public/porting/report', async (req, res) => {
    try {
        const { phoneNumber, currentOperator, newOperator } = req.body;
        
        if (!phoneNumber || !newOperator) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        if (!/^34\d{9}$/.test(phoneNumber)) {
            return res.status(400).json({ error: 'Formato de número inválido' });
        }

        const db = require('./config/db');
        const phoneNum = BigInt(phoneNumber.substring(2));

        // Buscar el rango que contiene este número
        const [ranges] = await db.query(
            'SELECT * FROM numero_ranges WHERE range_start <= ? AND range_end >= ? LIMIT 1',
            [phoneNum, phoneNum]
        );

        if (ranges && ranges.length > 0) {
            const range = ranges[0];
            
            // Actualizar el operador
            await db.query(
                'UPDATE numero_ranges SET operator_name = ? WHERE id = ?',
                [newOperator, range.id]
            );
            
            // Actualizar cache
            try {
                await db.query(
                    `INSERT INTO operators_cache (phone_number, operator_name, nrn) 
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE operator_name = VALUES(operator_name), nrn = VALUES(nrn)`,
                    [phoneNumber, newOperator, range.nrn]
                );
            } catch (cacheErr) {
                console.log('Cache update warning:', cacheErr.message);
            }
        }

        // Registrar en ported_numbers para auditoría
        await db.query(
            'INSERT INTO ported_numbers (phone_number, original_operator, current_operator, ported_date) VALUES (?, ?, ?, NOW())',
            [phoneNumber, currentOperator || 'Desconocido', newOperator]
        );

        // Log de actividad
        await Logger.log('PUBLIC_PORTING_REPORTED', {
            phoneNumber,
            from: currentOperator,
            to: newOperator,
            ip: req.ip
        });

        res.json({ 
            success: true, 
            message: `Portabilidad registrada: ${phoneNumber} → ${newOperator}`
        });
    } catch (err) {
        console.error('Public porting error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Verificar número con Vonage (Gratis - Plan Basic)
app.get('/api/vonage/verify/:number', async (req, res) => {
    try {
        const VonageService = require('./services/vonageService');
        
        if (!VonageService.isGratisAvailable()) {
            return res.status(400).json({ 
                error: 'Vonage no configurado',
                message: 'Configura VONAGE_API_KEY y VONAGE_API_SECRET en .env'
            });
        }

        const phoneNumber = req.params.number;
        
        // Validar formato
        if (!/^34\d{9}$/.test(phoneNumber)) {
            return res.status(400).json({ error: 'Formato inválido (34XXXXXXXXX)' });
        }

        const result = await VonageService.verifyNumber(phoneNumber);
        
        if (result.error) {
            return res.status(400).json(result);
        }

        await Logger.log('VONAGE_VERIFY', {
            phoneNumber,
            carrierName: result.carrierName,
            numberType: result.numberType
        });

        res.json(result);
    } catch (err) {
        console.error('Vonage verify error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Comparar BD con Vonage
app.get('/api/vonage/compare/:number/:dbOperator', async (req, res) => {
    try {
        const VonageService = require('./services/vonageService');
        const { number, dbOperator } = req.params;

        if (!VonageService.isGratisAvailable()) {
            return res.status(400).json({ 
                error: 'Vonage no configurado'
            });
        }

        const comparison = await VonageService.compareWithDatabase(number, decodeURIComponent(dbOperator));
        
        res.json(comparison);
    } catch (err) {
        console.error('Vonage compare error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== AUTENTICACIÓN ====================

// Login (generar token)
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        await Logger.log('LOGIN_FAILED', { ip: req.ip });
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    try {
        const token = jwt.sign(
            { admin: true, loginTime: new Date() },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await Logger.log('LOGIN_SUCCESS', { ip: req.ip });
        
        res.json({ token, message: 'Autenticación exitosa' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verificar token
app.get('/api/admin/verify', authenticateAdmin, (req, res) => {
    res.json({ valid: true, admin: req.admin });
});

// ==================== ENDPOINTS ADMIN (PROTEGIDOS) ====================

// Estadísticas
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const stats = await AnalyticsService.getStats(7);
        const total = stats.reduce((sum, s) => sum + (s.total_searches || 0), 0);
        const successful = stats.reduce((sum, s) => sum + (s.successful || 0), 0);
        const failed = stats.reduce((sum, s) => sum + (s.failed || 0), 0);
        const avgTime = Math.round(stats.reduce((sum, s) => sum + (s.avg_response_time || 0), 0) / (stats.length || 1));

        let operatorStats = await AnalyticsService.getOperatorStats();
        // Normalizar nombres de campos y convertir a números
        operatorStats = operatorStats.map(op => ({
            operator_found: op.operator || op.operator_found || 'Desconocido',
            total_searches: parseInt(op.searches || op.total_searches || 0),
            successful: parseInt(op.successful || 0),
            avg_response_time: parseFloat(op.avg_response_time || 0)
        }));

        const topNumbers = await AnalyticsService.getMostSearched(10);

        res.json({
            total,
            successful,
            failed,
            avg_time: avgTime,
            by_operator: operatorStats || [],
            top_numbers: topNumbers || []
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ 
            error: err.message,
            total: 0,
            successful: 0,
            failed: 0,
            avg_time: 0,
            by_operator: [],
            top_numbers: []
        });
    }
});

// Listar portabilidades
app.get('/api/admin/portings', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const [portings] = await db.query('SELECT * FROM ported_numbers ORDER BY ported_date DESC LIMIT 50');
        res.json(portings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar portabilidad (cambiar operador de un número)
app.post('/api/admin/porting/update', authenticateAdmin, async (req, res) => {
    try {
        const { phoneNumber, currentOperator, newOperator } = req.body;
        
        if (!phoneNumber || !newOperator) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        const db = require('./config/db');
        
        // Buscar el rango que contiene este número
        const phoneNum = BigInt(phoneNumber);
        const [ranges] = await db.query(
            'SELECT * FROM numero_ranges WHERE range_start <= ? AND range_end >= ? LIMIT 1',
            [phoneNum, phoneNum]
        );
        
        if (!ranges || ranges.length === 0) {
            return res.status(404).json({ error: 'Número no encontrado en rango' });
        }
        
        const range = ranges[0];
        
        // Actualizar el operador en numero_ranges
        await db.query(
            'UPDATE numero_ranges SET operator_name = ? WHERE id = ?',
            [newOperator, range.id]
        );
        
        // ACTUALIZAR O LIMPIAR CACHE para este número
        try {
            // Primero intentar actualizar si existe
            const [cacheEntry] = await db.query(
                'SELECT id FROM operators_cache WHERE phone_number = ?',
                [phoneNumber]
            );
            
            if (cacheEntry && cacheEntry.length > 0) {
                // Si existe en cache, actualizarlo
                await db.query(
                    'UPDATE operators_cache SET operator_name = ? WHERE phone_number = ?',
                    [newOperator, phoneNumber]
                );
            } else {
                // Si no existe, no hay nada que limpiar
            }
        } catch (cacheErr) {
            console.log('Cache update warning:', cacheErr.message);
        }
        
        // Registrar en ported_numbers para auditoría
        const now = new Date();
        await db.query(
            'INSERT INTO ported_numbers (phone_number, original_operator, current_operator, ported_date) VALUES (?, ?, ?, ?)',
            [phoneNumber, currentOperator || range.operator_name, newOperator, now]
        );
        
        // Log de actividad
        await Logger.log('PORTING_UPDATED', {
            phoneNumber,
            from: range.operator_name,
            to: newOperator,
            admin: req.admin
        });
        
        res.json({ 
            success: true, 
            message: `Operador actualizado: ${phoneNumber} → ${newOperator}`,
            updated: { phoneNumber, newOperator }
        });
        
    } catch (err) {
        console.error('Error updating porting:', err);
        res.status(500).json({ error: err.message });
    }
});

// Eliminar portabilidad
app.delete('/api/admin/porting/:id', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const result = await db.query('DELETE FROM ported_numbers WHERE id = ?', [req.params.id]);
        
        await Logger.log('PORTING_DELETED', { portingId: req.params.id });
        
        res.json({ success: true, message: 'Portabilidad eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reportar portabilidad
app.post('/api/admin/porting/report', authenticateAdmin, async (req, res) => {
    try {
        const { number, from, to } = req.body;
        const result = await PortingService.reportPorting(number, from, to);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar spam
app.get('/api/admin/spam', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const [spam] = await db.query('SELECT * FROM spam_numbers WHERE spam_score > 0 ORDER BY spam_score DESC LIMIT 50');
        res.json(spam);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reportar spam
app.post('/api/admin/spam/report', authenticateAdmin, async (req, res) => {
    try {
        const { number, category } = req.body;
        const result = await SpamService.reportSpam(number, category, 'ADMIN');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== GESTIONAR NÚMEROS ====================

// Importar números desde CSV
app.post('/api/admin/numbers/import-csv', authenticateAdmin, async (req, res) => {
    try {
        const { csv } = req.body;
        const db = require('./config/db');
        
        const lines = csv.split('\n').filter(line => line.trim() && !line.startsWith('phone_number'));
        let imported = 0;
        let failed = 0;

        for (const line of lines) {
            try {
                const [phone, operator, nrn, type] = line.split(',').map(v => v.trim());
                
                if (!phone || !operator) continue;
                
                // Validar formato de número
                if (!/^34\d{9}$/.test(phone)) {
                    failed++;
                    continue;
                }

                const phoneNum = BigInt(phone.substring(2)); // Quitar el 34
                
                // Insertar en numero_ranges
                await db.query(
                    `INSERT IGNORE INTO numero_ranges (range_start, range_end, operator_name, nrn, type) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [phoneNum, phoneNum, operator, nrn || null, type || 'MOBILE']
                );
                
                imported++;
            } catch (lineErr) {
                console.error('Line error:', lineErr.message);
                failed++;
            }
        }

        await Logger.log('CSV_IMPORTED', { imported, failed });

        res.json({ 
            success: true, 
            imported, 
            failed,
            message: `${imported} números importados, ${failed} fallidos`
        });
    } catch (err) {
        console.error('CSV import error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Agregar un número individual
app.post('/api/admin/numbers/add', authenticateAdmin, async (req, res) => {
    try {
        const { phone_number, operator_name, type } = req.body;
        
        if (!phone_number || !operator_name) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        if (!/^34\d{9}$/.test(phone_number)) {
            return res.status(400).json({ error: 'Formato de número inválido' });
        }

        const db = require('./config/db');
        const phoneNum = BigInt(phone_number.substring(2));

        // Insertar en numero_ranges
        const result = await db.query(
            `INSERT INTO numero_ranges (range_start, range_end, operator_name, type) 
             VALUES (?, ?, ?, ?)`,
            [phoneNum, phoneNum, operator_name, type || 'MOBILE']
        );

        await Logger.log('NUMBER_ADDED', { 
            phone_number, 
            operator_name,
            admin: req.admin 
        });

        res.json({ 
            success: true, 
            message: `Número ${phone_number} agregado exitosamente`,
            id: result[0].insertId
        });
    } catch (err) {
        console.error('Add number error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Obtener números agregados recientemente
app.get('/api/admin/numbers/recent', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const [numbers] = await db.query(
            `SELECT range_start as phone_number, operator_name, type, created_at 
             FROM numero_ranges 
             ORDER BY created_at DESC 
             LIMIT 50`
        );
        res.json(numbers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logs
app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const [logs] = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar API Keys
app.get('/api/admin/keys', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const [keys] = await db.query('SELECT id, api_key, user_name, is_active, requests_limit, requests_used, created_at FROM api_keys ORDER BY created_at DESC');
        res.json(keys);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear nueva API Key
app.post('/api/admin/keys/create', authenticateAdmin, async (req, res) => {
    try {
        const { userName, requestsLimit } = req.body;
        const db = require('./config/db');
        
        // Generar clave única
        const apiKey = 'sk_' + require('crypto').randomBytes(32).toString('hex');
        
        await db.query(
            'INSERT INTO api_keys (api_key, user_name, requests_limit) VALUES (?, ?, ?)',
            [apiKey, userName || 'Sin nombre', requestsLimit || 10000]
        );
        
        await Logger.log('API_KEY_CREATED', { userName });
        
        res.json({ 
            success: true, 
            apiKey,
            message: 'API Key creada exitosamente'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar API Key
app.delete('/api/admin/keys/:id', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        await db.query('DELETE FROM api_keys WHERE id = ?', [req.params.id]);
        
        await Logger.log('API_KEY_DELETED', { keyId: req.params.id });
        
        res.json({ success: true, message: 'API Key eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Desactivar/Activar API Key
app.patch('/api/admin/keys/:id/toggle', authenticateAdmin, async (req, res) => {
    try {
        const db = require('./config/db');
        const { isActive } = req.body;
        
        await db.query('UPDATE api_keys SET is_active = ? WHERE id = ?', [isActive, req.params.id]);
        
        await Logger.log('API_KEY_TOGGLED', { keyId: req.params.id, active: isActive });
        
        res.json({ success: true, message: `API Key ${isActive ? 'activada' : 'desactivada'}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// ==================== 404 ====================

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║    🚀 Telco Lookup Server Activo       ║
╠════════════════════════════════════════╣
║  🌐 Web: http://localhost:${PORT}/
║  🔐 Login: http://localhost:${PORT}/admin-login.html
║  🔧 API: http://localhost:${PORT}/api/health
║  📊 Dashboard: http://localhost:${PORT}/admin.html
╚════════════════════════════════════════╝
    `);
    
    Logger.log('SERVER_STARTED', { port: PORT });
});