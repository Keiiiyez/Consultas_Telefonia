const fs = require('fs');
const csv = require('csv-parser');
const db = require('./config/db');

async function importarRangos() {
    console.log("Iniciando importación de rangos CNMC...");
    

    const stream = fs.createReadStream('rangos_cnmc.csv')
        .pipe(csv({ separator: ';' }));

    for await (const row of stream) {
        try {
            if (row.RANGO_INICIAL && row.RANGO_FINAL && row.OPERADOR) {
                await db.query(
                    "INSERT INTO rangos_iniciales (inicio, fin, operador) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE operador = VALUES(operador)",
                    [row.RANGO_INICIAL, row.RANGO_FINAL, row.OPERADOR]
                );
            }
        } catch (err) {
            console.error(` Error en rango ${row.RANGO_INICIAL}:`, err.message);
        }
    }

    console.log("Importación finalizada con éxito.");
    process.exit(0);
}

importarRangos();