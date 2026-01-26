const axios = require('axios');
const db = require('../config/db'); // conexión a MySQL/PostgreSQL

async function getOperatorReliable(phoneNumber) {
    // 1. INTENTO EN BASE DE DATOS LOCAL 
    try {
        const [rows] = await db.query(
            "SELECT operator_name, nrn FROM operators_cache WHERE phone_number = ?", 
            [phoneNumber]
        );

        if (rows.length > 0) {
            return {
                current_operator: rows[0].operator_name,
                nrn: rows[0].nrn,
                source: "Local DB (CNMC/AOPM)",
                success: true
            };
        }
    } catch (dbError) {
        console.error("Fallo en DB Local, saltando a API...", dbError.message);
    }

    // 2. RESPALDO: CONSULTA A API EXTERNA 
    try {
        // Ejemplo con una API tipo LabsMobile o Twilio
        const apiResponse = await axios.get(`https://api.provider.com/v1/lookup`, {
            params: { 
                number: phoneNumber,
                key: process.env.API_KEY 
            }
        });

        const operatorData = {
            current_operator: apiResponse.data.carrier_name,
            nrn: apiResponse.data.nrn,
            source: "External API (HLR Realtime)",
            success: true
        };

        // 3. AUTO-REPARACIÓN: Guardamos en nuestra DB para la próxima vez
        // Así el sistema "aprende" y la próxima vez será gratis
        await db.query(
            "INSERT IGNORE INTO operators_cache (phone_number, operator_name, nrn) VALUES (?, ?, ?)",
            [phoneNumber, operatorData.current_operator, operatorData.nrn]
        );

        return operatorData;

    } catch (apiError) {
        console.error("Fallo total: Ni DB ni API responden.");
        return { success: false, error: "Servicio no disponible" };
    }
}

module.exports = { getOperatorReliable };