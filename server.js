app.use(express.static('public'));
const express = require('express');
const { getOperatorReliable } = require('./services/lookupService');
require('dotenv').config();

const app = express();
app.use(express.static('public'));

app.get('/api/lookup/:number', async (req, res) => {
    const result = await getOperatorReliable(req.params.number);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(503).json(result);
    }
});

app.listen(3000, () => console.log("Servidor híbrido activo en el puerto 3000"));