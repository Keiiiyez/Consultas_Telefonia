const axios = require('axios');
const db = require('../config/db');

async function getOperatorReliable(phoneNumber) {
    // 1. INTENTO EN BASE DE DATOS LOCAL (Gratis)
    try {
        const [rows] = await db.query(
            "SELECT operator_name, nrn FROM operators_cache WHERE phone_number = ?", 
            [phoneNumber]
        );

        if (rows.length > 0) {
            return {
                current_operator: rows[0].operator_name,
                nrn: rows[0].nrn,
                source: "Base de Datos Local (Interna)",
                success: true
            };
        }
    } catch (dbError) {
        console.error("Fallo en DB Local:", dbError.message);
    }

    // 2. RESPALDO: CONSULTA A API EXTERNA (Solo si no está en DB)
    // Nota: Necesitas una API KEY real para que esto funcione
    if (process.env.API_KEY) {
        try {
            const apiResponse = await axios.get(`https://api.provider.com/v1/lookup`, {
                params: { 
                    number: phoneNumber,
                    key: process.env.API_KEY 
                }
            });

            const operatorData = {
                current_operator: apiResponse.data.carrier_name,
                nrn: apiResponse.data.nrn,
                source: "API Externa (HLR Realtime)",
                success: true
            };

            // Guardamos en DB para ahorrar costes la próxima vez
            await db.query(
                "INSERT IGNORE INTO operators_cache (phone_number, operator_name, nrn) VALUES (?, ?, ?)",
                [phoneNumber, operatorData.current_operator, operatorData.nrn]
            );

            return operatorData;
        } catch (apiError) {
            console.error("Fallo en API externa.");
        }
    }

    return { success: false, error: "Número no encontrado en registros locales ni API configurada." };
}

module.exports = { getOperatorReliable };