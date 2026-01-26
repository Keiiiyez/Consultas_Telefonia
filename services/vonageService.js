// Vonage Number Insight - Plan Gratis (Basic)
const axios = require('axios');

class VonageService {
    constructor() {
        this.apiKey = process.env.VONAGE_API_KEY;
        this.apiSecret = process.env.VONAGE_API_SECRET;
        this.baseUrl = 'https://api.nexmo.com/ni/basic/json';
        this.enabled = this.apiKey && this.apiSecret;
    }

    /**
     * Verificar número con Vonage (Plan Gratis - Basic)
     * Información: país, tipo de línea, operador aproximado
     */
    async verifyNumber(phoneNumber) {
        if (!this.enabled) {
            return { error: 'Vonage no configurado', enabled: false };
        }

        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    api_key: this.apiKey,
                    api_secret: this.apiSecret,
                    number: phoneNumber,
                    country: 'ES'  // España por defecto
                },
                timeout: 5000
            });

            if (response.data.status !== '0') {
                return {
                    error: response.data.error_text || 'Error en Vonage',
                    status: response.data.status
                };
            }

            return {
                success: true,
                internationalFormat: response.data.international_format_number,
                nationalFormat: response.data.national_format_number,
                countryCode: response.data.country_code,
                countryName: response.data.country_name,
                carrierName: response.data.carrier_name || 'Desconocido',
                numberType: response.data.number_type, // 'mobile' o 'fixed-line'
                originalOperator: response.data.original_carrier || null,
                source: 'vonage_basic'
            };
        } catch (err) {
            console.error('Vonage API error:', err.message);
            return {
                error: 'Error conectando con Vonage',
                details: err.message
            };
        }
    }

    /**
     * Comparar operador de BD con Vonage
     */
    async compareWithDatabase(phoneNumber, dbOperator) {
        const vonageResult = await this.verifyNumber(phoneNumber);

        if (vonageResult.error) {
            return {
                compared: false,
                vonageError: vonageResult.error
            };
        }

        const vonageOperator = vonageResult.carrierName?.toLowerCase() || '';
        const dbOp = dbOperator?.toLowerCase() || '';

        const match = vonageOperator.includes(dbOp) || dbOp.includes(vonageOperator);

        return {
            compared: true,
            vonageInfo: vonageResult,
            dbOperator,
            match,
            message: match ? 'Operadores coinciden' : 'Posible portabilidad detectada',
            recommendation: !match ? `Considerar actualizar: ${dbOperator} → ${vonageResult.carrierName}` : null
        };
    }

    /**
     * Validar que el plan gratis esté disponible
     */
    isGratisAvailable() {
        return this.enabled;
    }
}

module.exports = new VonageService();
