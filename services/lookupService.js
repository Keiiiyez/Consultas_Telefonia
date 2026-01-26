const axios = require('axios');
const db = require('../config/db');
const { Logger, PortingService, SpamService, NumberInfoService, HLRService } = require('./advancedServices');

async function getOperatorReliable(phoneNumber, ipAddress = null) {
    const startTime = Date.now();
    let source = 'UNKNOWN';
    let success = false;
    let operator = null;

    try {
        // Validar número
        if (!NumberInfoService.validateNumber(phoneNumber)) {
            await logSearch(phoneNumber, null, 'INVALID', 0, false, ipAddress);
            return { 
                success: false, 
                error: "Número no válido. Usa formato: 34xxxxxxxxx" 
            };
        }

        // 1. VERIFICAR SI ES SPAM
        const spamCheck = await SpamService.checkSpam(phoneNumber);
        if (spamCheck.is_spam && spamCheck.spam_score > 50) {
            await Logger.log('SPAM_BLOCKED', { phoneNumber });
            await logSearch(phoneNumber, null, 'SPAM', Date.now() - startTime, false, ipAddress);
            return {
                success: false,
                warning: 'Este número está marcado como spam',
                spam_info: spamCheck
            };
        }

        // 2. INTENTO EN CACHÉ LOCAL
        const [cached] = await db.query(
            "SELECT operator_name, nrn FROM operators_cache WHERE phone_number = ?", 
            [phoneNumber]
        );

        if (cached.length > 0) {
            source = 'CACHE';
            operator = cached[0].operator_name;
            success = true;
            
            // Log
            await logSearch(phoneNumber, operator, source, Date.now() - startTime, success, ipAddress);
            
            return {
                current_operator: cached[0].operator_name,
                nrn: cached[0].nrn,
                source: "Caché Local",
                success: true
            };
        }

        // 3. BUSCAR EN TABLA DE RANGOS
        const phoneNum = BigInt(phoneNumber.replace(/^34/, ''));
        
        const [ranges] = await db.query(
            `SELECT operator_name, nrn, type FROM numero_ranges 
             WHERE range_start <= ? AND range_end >= ? 
             LIMIT 1`,
            [phoneNum, phoneNum]
        );

        if (ranges.length > 0) {
            source = 'RANGE';
            operator = ranges[0].operator_name;
            success = true;

            const result = {
                current_operator: ranges[0].operator_name,
                nrn: ranges[0].nrn,
                type: ranges[0].type,
                source: "Base de Datos Local (Rangos)",
                success: true
            };

            // Verificar portabilidad
            const porting = await PortingService.checkPorting(phoneNumber);
            if (porting.is_ported) {
                result.porting_info = porting;
                result.source = "Datos Local (con portabilidad registrada)";
            }

            // Guardar o actualizar en caché
            try {
                await db.query(
                    `INSERT INTO operators_cache (phone_number, operator_name, nrn) 
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE operator_name = VALUES(operator_name), nrn = VALUES(nrn)`,
                    [phoneNumber, result.current_operator, result.nrn]
                );
            } catch (cacheErr) {
                console.error("Cache error:", cacheErr.message);
            }

            // Log
            await logSearch(phoneNumber, operator, source, Date.now() - startTime, success, ipAddress);

            return result;
        }

        // 4. VERIFICACIÓN HLR
        const hlrCheck = await HLRService.checkNumberValidity(phoneNumber);
        if (!hlrCheck.is_valid) {
            await logSearch(phoneNumber, null, 'HLR', Date.now() - startTime, false, ipAddress);
            return {
                success: false,
                error: "Número inválido según validación HLR",
                hlr_info: hlrCheck
            };
        }

        // 5. RESPALDO: API EXTERNA
        if (process.env.API_KEY) {
            try {
                const apiResponse = await axios.get(`https://api.provider.com/v1/lookup`, {
                    params: { 
                        number: phoneNumber,
                        key: process.env.API_KEY 
                    }
                });

                operator = apiResponse.data.carrier_name;
                source = 'API';
                success = true;

                const operatorData = {
                    current_operator: apiResponse.data.carrier_name,
                    nrn: apiResponse.data.nrn,
                    source: "API Externa",
                    success: true
                };

                await logSearch(phoneNumber, operator, source, Date.now() - startTime, success, ipAddress);
                return operatorData;
            } catch (apiError) {
                console.error("API error:", apiError.message);
            }
        }

        // No encontrado
        await logSearch(phoneNumber, null, 'NOT_FOUND', Date.now() - startTime, false, ipAddress);
        return { 
            success: false, 
            error: "Número no encontrado en nuestros registros" 
        };

    } catch (error) {
        console.error("Lookup error:", error);
        await logSearch(phoneNumber, null, 'ERROR', Date.now() - startTime, false, ipAddress);
        return {
            success: false,
            error: "Error durante la búsqueda"
        };
    }
}

// Función auxiliar para logging
async function logSearch(phoneNumber, operator, source, responseTime, success, ipAddress) {
    try {
        await db.query(
            `INSERT INTO search_history 
             (phone_number, operator_found, source, response_time_ms, success, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [phoneNumber, operator, source, responseTime, success, ipAddress]
        );
    } catch (err) {
        console.error("Error logging search:", err.message);
    }
}

module.exports = { getOperatorReliable };


