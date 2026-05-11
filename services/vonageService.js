const axios = require('axios');
const db = require('../config/db'); // Conexión a la base de datos

class VeriphoneService {
    constructor() {
        this.apiKey = process.env.VERIPHONE_API_KEY;
        this.baseUrl = 'https://api.veriphone.io/v2/verify';
        this.enabled = !!this.apiKey;
    }

    async verifyNumber(phoneNumber) {
        if (!this.enabled) {
            return { error: 'Veriphone no configurado', enabled: false };
        }

        // 1. Intentar obtener de la caché (válida por 7 días)
        try {
            const [cached] = await db.query(
                "SELECT * FROM veriphone_cache WHERE phone_number = ? AND last_checked >= NOW() - INTERVAL 7 DAY",
                [phoneNumber]
            );
            if (cached.length > 0) {
                console.log(`Cache hit for ${phoneNumber}`);
                return {
                    success: true,
                    valid: cached[0].phone_valid,
                    internationalFormat: phoneNumber, // o el formato que tienes en caché
                    nationalFormat: phoneNumber.slice(2),
                    countryCode: '34',
                    countryName: cached[0].country_name,
                    carrierName: cached[0].carrier_name,
                    numberType: cached[0].number_type,
                    source: 'cache',
                    cached: true,
                    last_checked: cached[0].last_checked
                };
            }
        } catch (dbErr) {
            console.error('Error al consultar caché Veriphone:', dbErr.message);
            // Continúa a la API si falla la caché
        }

        // 2. Cache miss → llamar a la API de Veriphone
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    key: this.apiKey,
                    phone: phoneNumber
                },
                timeout: 5000
            });

            if (response.data.status !== 'success') {
                return {
                    error: 'Error en la validación',
                    details: response.data.message
                };
            }

            const result = {
                success: true,
                valid: response.data.phone_valid,
                internationalFormat: response.data.international_number,
                nationalFormat: response.data.local_number,
                countryCode: response.data.country_code,
                countryName: response.data.country,
                carrierName: response.data.carrier || 'Desconocido',
                numberType: response.data.phone_type,
                source: 'veriphone'
            };

            // 3. Guardar en caché
            try {
                await db.query(
                    `INSERT INTO veriphone_cache 
                    (phone_number, carrier_name, number_type, country_name, phone_valid, response_json, last_checked) 
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        carrier_name = VALUES(carrier_name),
                        number_type = VALUES(number_type),
                        country_name = VALUES(country_name),
                        phone_valid = VALUES(phone_valid),
                        response_json = VALUES(response_json),
                        last_checked = NOW()`,
                    [
                        phoneNumber,
                        result.carrierName,
                        result.numberType,
                        result.countryName,
                        result.valid,
                        JSON.stringify(result) // guardamos toda la respuesta por si hace falta
                    ]
                );
            } catch (cacheErr) {
                console.error('Error al guardar en caché Veriphone:', cacheErr.message);
                // No interrumpimos la respuesta
            }

            return result;
        } catch (err) {
            console.error('Veriphone API error:', err.message);
            return {
                error: 'Error conectando con Veriphone',
                details: err.message
            };
        }
    }

    async compareWithDatabase(phoneNumber, dbOperator) {
        // Este método ya llama a verifyNumber, que ahora usa la caché internamente
        const result = await this.verifyNumber(phoneNumber);

        if (result.error) return { compared: false, error: result.error };

        const externalOp = result.carrierName?.toLowerCase() || '';
        const dbOp = dbOperator?.toLowerCase() || '';
        const match = externalOp.includes(dbOp) || dbOp.includes(externalOp);

        return {
            compared: true,
            info: result,
            dbOperator,
            match,
            message: match ? 'Coinciden' : 'Discrepancia detectada'
        };
    }
}

module.exports = new VeriphoneService();