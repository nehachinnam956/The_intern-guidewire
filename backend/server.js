require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use((req, res, next) => { req.db = pool; next(); });

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/stores',  require('./routes/stores'));
app.use('/api/policy',  require('./routes/policy'));
app.use('/api/claims',  require('./routes/claims'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/payment', require('./routes/payment'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.listen(PORT, () => console.log(`DarkShield backend running on port ${PORT}`));
module.exports = { pool };