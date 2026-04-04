process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB, getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

initDB().then(db => {
  // Attach db to every request AFTER init
  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  app.use('/api/auth',    require('./routes/auth'));
  app.use('/api/stores',  require('./routes/stores'));
  app.use('/api/policy',  require('./routes/policy'));
  app.use('/api/claims',  require('./routes/claims'));
  app.use('/api/weather', require('./routes/weather'));
  app.use('/api/admin',   require('./routes/admin'));
  app.use('/api/payment', require('./routes/payment'));

  app.get('/health', (req, res) => res.json({ 
    status: 'ok', db: 'sqlite', time: new Date() 
  }));

  app.listen(PORT, () => console.log(
    `🚀 DarkShield running on port ${PORT} with SQLite`
  ));
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});