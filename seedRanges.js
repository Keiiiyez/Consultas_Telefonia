const db = require('./config/db');

async function seedRanges() {
    console.log(" Iniciando carga masiva de rangos");

const data = {
    'MOVISTAR': ['600', '604', '605', '606', '609', '619', '629', '630', '639', '650', '659', '670', '679', '696', '699'],
        'O2': ['620', '621'],
        'VODAFONE': ['610', '617', '627', '649', '654', '655', '656', '657', '658', '661', '662', '663', '664', '665', '669'],
        'LOWI': ['607', '608', '660', '667', '668'],
        'ORANGE': ['615', '616', '618', '625', '646', '647', '648', '651', '653', '671', '672', '673', '674', '675', '676', '677', '681', '689', '717', '733', '744', '747', '755'],
        'JAZZTEL': ['640', '644', '645'],
        'SIMYO': ['641'], 
        'YOIGO': ['622'],
        'PEPEPHONE': ['634'],
        'MASMOVIL': ['623', '633', '693'],
        'LLAMAYA': ['631', '632'],
        'DIGI': ['722'],
        'FINETWORK': ['611', '613', '602'],
        'LEBARA': ['694'],
        'EUSKALTEL': ['688', '652'],
        'R': ['698'],
        'TELECABLE': ['684'],
        'ADAMO': ['642', '643'],
        'ADAMO_PROX': ['680', '682', '683', '685', '686', '687']
    };


const nrnMap = { 
    'Movistar': '3400', 
    'Vodafone': '3410', 
    'Orange': '3420', 
    'Yoigo': '3430', 
    'Digi': '3407', 
    'MasMovil': '3430',
    'Jazztel': '3420',
    'Lebara': '3410',
    'Finetwork': '3408',
    'Simyo': '3409',
    'Lowi': '3411',
    'Pepephone': '3412',
    'Llamaya': '3414',
    'Euskaltel': '3415',
    'R': '3416',
    'Telecable': '3417',
    'Adamo': '3425'
};
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