const db = require('../config/db');

// Logger simple
class Logger {
    static async log(action, details) {
        try {
            await db.query(
                "INSERT INTO activity_logs (action, details) VALUES (?, ?)",
                [action, JSON.stringify(details)]
            );
        } catch (err) {
            console.error("Error logging:", err.message);
        }
    }
}

// Gestión de portabilidad
class PortingService {
    static async checkPorting(phoneNumber) {
        try {
            const [ported] = await db.query(
                "SELECT * FROM ported_numbers WHERE phone_number = ?",
                [phoneNumber]
            );

            if (ported.length > 0) {
                return {
                    is_ported: true,
                    original_operator: ported[0].original_operator,
                    current_operator: ported[0].current_operator,
                    ported_date: ported[0].ported_date
                };
            }
            return { is_ported: false };
        } catch (err) {
            console.error("Error checking porting:", err.message);
            return { is_ported: false, error: err.message };
        }
    }

    static async reportPorting(phoneNumber, originalOp, currentOp) {
        try {
            await db.query(
                `INSERT INTO ported_numbers (phone_number, original_operator, current_operator, verified) 
                 VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_operator = ?`,
                [phoneNumber, originalOp, currentOp, false, currentOp]
            );
            await Logger.log('PORTING_REPORTED', { phoneNumber, from: originalOp, to: currentOp });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

// Gestión de spam/fraude
class SpamService {
    static async checkSpam(phoneNumber) {
        try {
            const [spam] = await db.query(
                "SELECT * FROM spam_numbers WHERE phone_number = ?",
                [phoneNumber]
            );

            if (spam.length > 0) {
                return {
                    is_spam: true,
                    spam_score: spam[0].spam_score,
                    category: spam[0].category,
                    reports: spam[0].reports
                };
            }
            return { is_spam: false, spam_score: 0 };
        } catch (err) {
            console.error("Error checking spam:", err.message);
            return { is_spam: false };
        }
    }

    static async reportSpam(phoneNumber, category = 'SPAM', source = 'USER') {
        try {
            // Incrementar score
            await db.query(
                `INSERT INTO spam_numbers (phone_number, spam_score, category, reports, source) 
                 VALUES (?, 10, ?, 1, ?)
                 ON DUPLICATE KEY UPDATE 
                    spam_score = spam_score + 10,
                    reports = reports + 1`,
                [phoneNumber, category, source]
            );
            await Logger.log('SPAM_REPORTED', { phoneNumber, category });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

// Información completa del número
class NumberInfoService {
    static async getFullInfo(phoneNumber) {
        try {
            // Detectar tipo de número
            const number = phoneNumber.replace(/^34/, '');
            let numberType = 'UNKNOWN';
            let area = 'España';

            if (number.match(/^[6-7]\d{8}$/)) numberType = 'MOBILE';
            else if (number.match(/^9\d{8}$/)) numberType = 'FIXED';
            else if (number.match(/^8\d{8}$/)) numberType = 'PREMIUM';
            else if (number.match(/^5[0-7]\d{7}$/)) numberType = 'VOIP';

            // Área aproximada por prefijo
            const prefix = number.substring(0, 3);
            const areaMap = {
                '600': 'Nacional', '607': 'Nacional', '622': 'Nacional',
                '625': 'Nacional', '650': 'Nacional',
                '911': 'Madrid', '912': 'Madrid',
                '934': 'Barcelona', '935': 'Barcelona'
            };
            area = areaMap[prefix] || 'España';

            return {
                type: numberType,
                area,
                format: this.formatNumber(phoneNumber),
                is_valid: this.validateNumber(phoneNumber),
                length: number.length
            };
        } catch (err) {
            return { error: err.message };
        }
    }

    static validateNumber(phoneNumber) {
        // Validar que sea número español válido
        return /^34[0-9]{9}$/.test(phoneNumber);
    }

    static formatNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.length === 12) {
            return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`;
        }
        return phoneNumber;
    }
}

// Estadísticas y análisis
class AnalyticsService {
    static async getStats(days = 7) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_searches,
                    COUNT(DISTINCT phone_number) as unique_numbers,
                    COUNT(CASE WHEN success = true THEN 1 END) as successful,
                    COUNT(CASE WHEN success = false THEN 1 END) as failed,
                    AVG(response_time_ms) as avg_response_time,
                    source,
                    operator_found
                FROM search_history
                WHERE search_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY source, operator_found
            `;
            
            const [stats] = await db.query(query, [days]);
            return stats;
        } catch (err) {
            console.error("Error getting stats:", err.message);
            return [];
        }
    }

    static async getMostSearched(limit = 10) {
        try {
            const [data] = await db.query(`
                SELECT phone_number, COUNT(*) as searches, operator_found
                FROM search_history
                WHERE success = true
                GROUP BY phone_number
                ORDER BY searches DESC
                LIMIT ?
            `, [limit]);
            return data;
        } catch (err) {
            return [];
        }
    }

    static async getOperatorStats() {
        try {
            const [stats] = await db.query(`
                SELECT 
                    operator_found as operator,
                    COUNT(*) as searches,
                    COUNT(CASE WHEN success = true THEN 1 END) as successful,
                    ROUND(AVG(response_time_ms), 2) as avg_response_time
                FROM search_history
                WHERE operator_found IS NOT NULL
                GROUP BY operator_found
                ORDER BY searches DESC
            `);
            return stats;
        } catch (err) {
            return [];
        }
    }
}

// Verificación HLR (simulada - puedes integrar Twilio/Vonage)
class HLRService {
    static async checkNumberValidity(phoneNumber) {
        try {
            // Aquí irías a una API real como Twilio o Vonage
            // Por ahora lo simulamos
            
            // Validación básica
            const isValid = NumberInfoService.validateNumber(phoneNumber);
            
            return {
                number: phoneNumber,
                is_valid: isValid,
                status: isValid ? 'ACTIVE' : 'INVALID',
                last_checked: new Date(),
                source: 'LOCAL_VALIDATION' // Cambiar a 'HLR_API' si usas API real
            };
        } catch (err) {
            return { error: err.message };
        }
    }
}

module.exports = {
    Logger,
    PortingService,
    SpamService,
    NumberInfoService,
    AnalyticsService,
    HLRService
};
