const db = require('./config/db');

// Rangos reales de operadores españoles (CNMC)
const operatorRanges = [
    // MOVISTAR - 600-604, 650-653
    { start: 600000000, end: 604999999, operator: 'Movistar', nrn: '3400', type: 'MOBILE' },
    { start: 650000000, end: 653999999, operator: 'Movistar', nrn: '3400', type: 'MOBILE' },
    
    // VODAFONE - 607-609
    { start: 607000000, end: 609999999, operator: 'Vodafone', nrn: '3410', type: 'MOBILE' },
    
    // ORANGE - 625, 671-677
    { start: 625000000, end: 625999999, operator: 'Orange', nrn: '3420', type: 'MOBILE' },
    { start: 671000000, end: 677999999, operator: 'Orange', nrn: '3420', type: 'MOBILE' },
    
    // YOIGO - 622-623
    { start: 622000000, end: 623999999, operator: 'Yoigo', nrn: '3430', type: 'MOBILE' },
    
    // VIRTUAL OPERATORS (MVNOs) - 690-695
    { start: 690000000, end: 695999999, operator: 'MVNO (Pepephone/Jazztel)', nrn: 'MVNO', type: 'MOBILE' },
    
    // FIXED LINES - 9XX
    { start: 900000000, end: 999999999, operator: 'Fixed Line', nrn: 'FIXED', type: 'FIXED' },
    
    // Otros rangos especiales
    { start: 605000000, end: 606999999, operator: 'Movistar', nrn: '3400', type: 'MOBILE' },
    { start: 610000000, end: 619999999, operator: 'Orange', nrn: '3420', type: 'MOBILE' },
    { start: 620000000, end: 621999999, operator: 'Orange', nrn: '3420', type: 'MOBILE' },
    { start: 654000000, end: 669999999, operator: 'Vodafone', nrn: '3410', type: 'MOBILE' },
    { start: 680000000, end: 689999999, operator: 'Yoigo', nrn: '3430', type: 'MOBILE' }
];

async function seedRanges() {
    console.log("📱 Insertando rangos de operadores españoles...");
    
    try {
        for (let range of operatorRanges) {
            await db.query(
                `INSERT INTO numero_ranges (range_start, range_end, operator_name, nrn, type) 
                 VALUES (?, ?, ?, ?, ?)`,
                [range.start, range.end, range.operator, range.nrn, range.type]
            );
            console.log(`✅ ${range.operator}: ${range.start} - ${range.end}`);
        }
        console.log("\n🎉 Todos los rangos insertados correctamente!");
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log("ℹ️  Los rangos ya existen en la base de datos");
            process.exit(0);
        } else {
            console.error("❌ Error:", error.message);
            process.exit(1);
        }
    }
}

seedRanges();
