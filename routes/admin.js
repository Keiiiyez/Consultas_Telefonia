// Al inicio del archivo, importa el servicio (ajusta la ruta según tu estructura)
const veriphoneService = require('../services/vonageService');

// Asegúrate de que el middleware de autenticación se llame 'auth' o como lo tengas definido
// Si no lo tienes como middleware global en el router, úsalo directamente en cada ruta:
// Verificar número con Veriphone
router.get('/verify', auth, async (req, res) => {
    try {
        const { number } = req.query;
        if (!number) {
            return res.status(400).json({ error: 'Falta el parámetro number' });
        }

        const result = await veriphoneService.verifyNumber(number);
        return res.json(result);
    } catch (err) {
        console.error('Error en /api/admin/verify:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Comparar con operador de la BD
router.post('/compare', auth, async (req, res) => {
    try {
        const { number, operator } = req.body;
        if (!number || !operator) {
            return res.status(400).json({ error: 'Faltan number u operator' });
        }

        const result = await veriphoneService.compareWithDatabase(number, operator);
        return res.json(result);
    } catch (err) {
        console.error('Error en /api/admin/compare:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});