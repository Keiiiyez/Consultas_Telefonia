const fs = require('fs');
const csv = require('csv-parser');
const db = require('./config/db');

async function importarRangos() {
    console.log("Iniciando importación de rangos CNMC...");
    
    fs.createReadStream('rangos_cnmc.csv') // El archivo que descargaste
        .pipe(csv({ separator: ';' })) 
        .on('data', async (row) => {
            try {
                // Insertamos cada rango en la tabla
                // Nota: Esto asume que has adaptado tu tabla para rangos
                await db.query(
                    "INSERT INTO rangos_iniciales (inicio, fin, operador) VALUES (?, ?, ?)",
                    [row.RANGO_INICIAL, row.RANGO_FINAL, row.OPERADOR]
                );
            } catch (err) {
                // Ignorar duplicados
            }
        })
        .on('end', () => {
            console.log("Importación finalizada con éxito.");
        });
}

importarRangos();