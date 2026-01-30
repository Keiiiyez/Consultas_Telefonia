const fs = require('fs');
const csv = require('csv-parser');
const db = require('./config/db');

async function importarRangos() {
    console.log("Iniciando importación de rangos CNMC...");
    
    try {
        fs.createReadStream('rangos_cnmc.csv') 
            .pipe(csv({ separator: ';' })) 
            .on('data', async (row) => {
                try {
                    
                    await db.query(
                        "INSERT INTO rangos_iniciales (inicio, fin, operador) VALUES (?, ?, ?)",
                        [row.RANGO_INICIAL, row.RANGO_FINAL, row.OPERADOR]
                    );
                } catch (err) {
                }
            })
            .on('end', () => {
                console.log("Importación finalizada con éxito.");
                process.exit();
            });
    } catch (error) {
        console.error("Error iniciando importación:", error.message);
        process.exit(1);
    }
}

importarRangos();