const db = require('./config/db');

async function seedRanges() {
    console.log(" Iniciando carga masiva de rangos");

    const data = {
        'Movistar': ['600', '609', '619', '629', '630', '639', '650', '659', '670', '679', '696', '699', '604', '605', '606'],
        'Vodafone': ['607', '608', '610', '617', '627', '649', '660', '669', '654', '655', '656', '657', '658', '661', '662', '663', '664', '665', '666', '667', '668'],
        'Orange': ['615', '616', '618', '625', '642', '643', '646', '647', '648', '651', '652', '653', '671', '672', '673', '674', '675', '676', '677', '680', '681', '682', '683', '684', '685', '686', '687', '688', '689', '717', '733', '744', '747', '755'],
        'Yoigo': ['622'],
        'MasMovil': ['623', '633', '693'],
        'Jazztel': ['640', '644', '645'],
        'Lebara': ['632', '634', '694'],
        'Digi': ['722']
    };

    const nrnMap = { 'Movistar': '3400', 'Vodafone': '3410', 'Orange': '3420', 'Yoigo': '3430', 'Digi': '3407', 'MasMovil': '3430',
        'Jazztel': '3420',
        'Lebara': '3410' };

    try {
  

        for (const [operator, prefixes] of Object.entries(data)) {
            const nrn = nrnMap[operator] || 'N/A';
            
            for (const prefix of prefixes) {
    
                const start = parseInt(prefix.padEnd(9, '0'));
                const end = parseInt(prefix.padEnd(9, '9'));

                await db.query(
                    `INSERT INTO numero_ranges (range_start, range_end, operator_name, nrn, type) 
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE operator_name = VALUES(operator_name)`,
                    [start, end, operator, nrn, 'MOBILE']
                );
            }
            console.log(` Cargados ${prefixes.length} prefijos para ${operator}`);
        }

        await db.query(
            "INSERT INTO numero_ranges (range_start, range_end, operator_name, nrn, type) VALUES (?, ?, ?, ?, ?)",
            [900000000, 999999999, 'Fixed Line', 'FIXED', 'FIXED']
        );

        console.log("\n Rango de precisión es mayor.");
        process.exit(0);
    } catch (error) {
        console.error("Error durante el seeding:", error.message);
        process.exit(1);
    }
}

seedRanges();