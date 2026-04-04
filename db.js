const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'darkshield.db.bin');
let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ sql.js database loaded from file');
  } else {
    db = new SQL.Database();
    console.log('✅ sql.js database ready (new)');
  }
  await seedStores();
  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function seedStores() {
  db.run(`CREATE TABLE IF NOT EXISTS dark_stores (
    id TEXT PRIMARY KEY,
    name TEXT, city TEXT, risk_score REAL,
    risk_label TEXT, zone TEXT, hist_claims INTEGER,
    lat REAL, lng REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS riders (
    id TEXT PRIMARY KEY,
    name TEXT, phone TEXT UNIQUE, partner_id TEXT,
    platform TEXT, city TEXT, tenure_months INTEGER,
    shift_pattern TEXT, daily_baseline REAL DEFAULT 850,
    gss_score INTEGER DEFAULT 85,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    rider_id TEXT, store_id TEXT,
    weekly_premium REAL, max_coverage REAL,
    status TEXT DEFAULT 'active',
    next_renewal TEXT,
    razorpay_payment_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(rider_id) REFERENCES riders(id),
    FOREIGN KEY(store_id) REFERENCES dark_stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    rider_id TEXT, policy_id TEXT,
    store_id TEXT,
    trigger_type TEXT, severity_pct REAL,
    hours_affected REAL, payout_amount REAL,
    gss_score INTEGER, status TEXT DEFAULT 'processing',
    upi_transaction_id TEXT,
    auto_approved INTEGER DEFAULT 0,
    sources TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(rider_id) REFERENCES riders(id)
  )`);

  const count = query(db, `SELECT COUNT(*) as c FROM dark_stores`);
  if (count.rows[0].c > 0) return;

  const stores = [
    ['DS001','Koramangala Hub','Bengaluru',1.72,'High Flood Risk','Low-lying flood-prone',7,12.9352,77.6245],
    ['DS002','Andheri West Hub','Mumbai',1.28,'Coastal + Traffic','Coastal exposure',4,19.1283,72.8374],
    ['DS003','Connaught Place','Delhi',1.15,'Extreme Heat Zone','Urban heat island',3,28.6315,77.2167],
    ['DS004','Baner Road Hub','Pune',0.78,'Low Risk Zone','Historically safe',1,18.5590,73.7868],
    ['DS005','Hitech City Hub','Hyderabad',1.02,'Mixed Exposure','Mixed terrain',2,17.4435,78.3772],
  ];

  stores.forEach(s => {
    db.run(`INSERT INTO dark_stores VALUES (?,?,?,?,?,?,?,?,?)`, s);
  });
  console.log('✅ Dark stores seeded');
}

function query(dbInstance, sql, params = []) {
  try {
    const result = dbInstance.exec(sql, params);
    if (!result || result.length === 0) return { rows: [] };
    const { columns, values } = result[0];
    const rows = values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]]))
    );
    return { rows };
  } catch (e) {
    throw new Error(e.message);
  }
}

function getDB() { return db; }

module.exports = { initDB, query, getDB, saveDB };