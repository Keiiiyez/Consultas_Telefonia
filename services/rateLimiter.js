const db = require('../config/db');

// Rate limiting por IP
class RateLimiter {
    static limitByIP(windowMs = 15 * 60 * 1000, maxRequests = 100) {
        const requests = new Map();

        return async (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            const now = Date.now();

            if (!requests.has(ip)) {
                requests.set(ip, []);
            }

            const timestamps = requests.get(ip);
            const recentRequests = timestamps.filter(t => now - t < windowMs);

            if (recentRequests.length >= maxRequests) {
                return res.status(429).json({
                    error: 'Demasiadas solicitudes. Intenta en 15 minutos.',
                    retry_after: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
                });
            }

            recentRequests.push(now);
            requests.set(ip, recentRequests);
            next();
        };
    }

    // Rate limiting por API Key
    static async limitByAPIKey(req, res, next) {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({ error: 'API Key requerida' });
        }

        try {
            const [keys] = await db.query(
                "SELECT * FROM api_keys WHERE api_key = ? AND is_active = true",
                [apiKey]
            );

            if (keys.length === 0) {
                return res.status(403).json({ error: 'API Key inválida' });
            }

            const key = keys[0];

            // Verificar límite de requests
            if (key.requests_used >= key.requests_limit) {
                return res.status(429).json({
                    error: 'Límite de requests alcanzado este mes',
                    requests_used: key.requests_used,
                    requests_limit: key.requests_limit
                });
            }

            req.apiKey = key;
            next();
        } catch (err) {
            res.status(500).json({ error: 'Error validando API Key' });
        }
    }

    // Actualizar uso de API Key
    static async recordRequest(apiKeyId) {
        try {
            await db.query(
                "UPDATE api_keys SET requests_used = requests_used + 1 WHERE id = ?",
                [apiKeyId]
            );
        } catch (err) {
            console.error("Error recording request:", err.message);
        }
    }
}

module.exports = RateLimiter;
