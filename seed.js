const db = require('./config/db'); // Tu conexión a la DB

const mainRanges = [
    { inicio: 600000000, fin: 600999999, operador: 'Movistar' },
    { inicio: 607000000, fin: 607999999, operador: 'Vodafone' },
    { inicio: 622000000, fin: 622999999, operador: 'Yoigo' },
    { inicio: 625000000, fin: 625999999, operador: 'Orange' },
    { inicio: 650000000, fin: 650999999, operador: 'Movistar' }
];

async function seed() {
    console.log("Insertando rangos de prueba...");
    try {
        for (let r of mainRanges) {
            await db.query(
                "INSERT INTO operators_cache (phone_number, operator_name, nrn) VALUES (?, ?, ?)",
                [`34${r.inicio}`, r.operador, 'N/A']
            );
        }
        console.log("¡Listo! Ya puedes probar tu web.");
    } catch (error) {
        console.error("Error durante seed:", error);
    } finally {
        process.exit();
    }
}

seed();