const router = require('express').Router();
const { authMiddleware } = require('./auth');
const { query } = require('../db');
const crypto = require('crypto');

router.post('/file', authMiddleware, async (req, res) => {
  const { trigger_type, simulate } = req.body;
  try {
    const riderRes = await query(req.db, `SELECT * FROM riders WHERE id=?`, [req.rider_id]);
    const policyRes = await query(req.db,
      `SELECT p.*, ds.id as ds_id, ds.lat, ds.lng, ds.name as store_name, ds.city
       FROM policies p JOIN dark_stores ds ON ds.id = p.store_id
       WHERE p.rider_id=? AND p.status='active' ORDER BY p.created_at DESC LIMIT 1`,
      [req.rider_id]
    );
    if (!policyRes.rows.length) return res.status(400).json({ error: 'No active policy' });

    const rider = riderRes.rows[0];
    const policy = policyRes.rows[0];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const TRIGGER_APIS = {
      flood: 'IMD Rainfall API + OpenWeatherMap',
      heat: 'IMD Heat Alert + Platform API',
      curfew: 'News API + Google Traffic',
      aqi: 'CPCB AQI API',
      closure: 'Platform Operations API'
    };
    const TRIGGER_RESULTS = {
      flood: '✓ 52mm rainfall/90min confirmed at store coordinates (threshold: 40mm)',
      heat: '✓ 47.2°C confirmed at store zone (threshold: 45°C)',
      curfew: '✓ Road access blocked >60min confirmed by 2 sources',
      aqi: '✓ AQI 423 sustained >2hrs (threshold: 400)',
      closure: '✓ Platform forced store closure confirmed'
    };

    send({ step:1, msg:`[TRIGGER] ${trigger_type.toUpperCase()} detected at ${policy.store_name}` });
    await delay(800);
    send({ step:2, msg:`[${TRIGGER_APIS[trigger_type]?.split('+')[0].trim()}] ${TRIGGER_RESULTS[trigger_type]}` });
    await delay(700);
    send({ step:3, msg:`[CROSS-VALIDATOR] ${TRIGGER_APIS[trigger_type]?.split('+')[1]?.trim() || 'Secondary API'} ✓ confirmed` });
    await delay(800);
    const gss = rider.gss_score || 85;
    send({ step:4, msg:`[FRAUD-ENGINE] Genuine Stranding Score: ${gss}/100 → ${gss>=70?'AUTO-APPROVED ✓':'FAST-TRACK REVIEW ⚡'}` });
    await delay(700);

    const payout = Math.round((rider.daily_baseline || 850) * 0.80 * (3/5));
    send({ step:5, msg:`[PAYOUT] ₹${rider.daily_baseline||850} × 0.80 × (3/5hr) = ₹${payout}` });
    await delay(700);

    const txId = `DS${Date.now().toString().slice(-8)}`;
    const claimId = crypto.randomUUID();
    await query(req.db,
      `INSERT INTO claims (id, policy_id, rider_id, store_id, trigger_type, gss_score, status, hours_affected, severity_pct, payout_amount, upi_transaction_id, auto_approved, resolved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
      [claimId, policy.id, req.rider_id, policy.ds_id, trigger_type, gss, gss>=70?'approved':'manual_review', 3, 80, payout, txId, gss>=70?1:0]
    );

    send({ step:6, msg:`[UPI-GATEWAY] ✓ ₹${payout} sent — Transaction ID: ${txId}` });
    await delay(800);
    send({ step:7, msg:`[SMS] "DarkShield paid ₹${payout} for 3hrs lost to ${trigger_type} at ${policy.store_name}"` });

    const claimResult = await query(req.db, `SELECT * FROM claims WHERE id=?`, [claimId]);
    send({ done:true, claim: claimResult.rows[0], payout, tx_id: txId });
    res.end();
  } catch(err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const result = await query(req.db,
      `SELECT c.*, ds.name as store_name FROM claims c
       JOIN dark_stores ds ON ds.id = c.store_id
       WHERE c.rider_id=? ORDER BY c.created_at DESC LIMIT 20`,
      [req.rider_id]
    );
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: 'Failed to fetch claims' }); }
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
module.exports = router;
