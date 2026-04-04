const router = require('express').Router();
const { authMiddleware } = require('./auth');
const { query, saveDB } = require('../db');
const crypto = require('crypto');

router.post('/create', async (req, res) => {
  const { store_id, weekly_premium, max_coverage, razorpay_payment_id, rider_id } = req.body;
  let riderId = rider_id;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'darkshield_secret');
      riderId = decoded.rider_id;
    } catch(e) {}
  }
  if (!riderId) return res.status(400).json({ error: 'rider_id required' });
  try {
    await query(req.db, `UPDATE policies SET status='cancelled' WHERE rider_id=? AND status='active'`, [riderId]);
    const nextMonday = getNextMonday();
    const id = crypto.randomUUID();
    await query(req.db,
      `INSERT INTO policies (id, rider_id, store_id, weekly_premium, max_coverage, next_renewal, razorpay_payment_id)
       VALUES (?,?,?,?,?,?,?)`,
      [id, riderId, store_id, weekly_premium, max_coverage, nextMonday, razorpay_payment_id || null]
    );
    saveDB();
    const result = await query(req.db, `SELECT * FROM policies WHERE id=?`, [id]);
    res.json({ success: true, policy: result.rows[0] });
  } catch (err) {
    console.error('Policy error:', err.message);
    res.status(500).json({ error: 'Policy creation failed', detail: err.message });
  }
});

router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await query(req.db,
      `SELECT p.*, ds.name as store_name, ds.risk_score, ds.risk_label,
              ds.city as store_city, ds.lat, ds.lng, ds.zone as zone_description
       FROM policies p JOIN dark_stores ds ON ds.id = p.store_id
       WHERE p.rider_id=? AND p.status != 'cancelled'
       ORDER BY p.created_at DESC LIMIT 1`,
      [req.rider_id]
    );
    res.json({ policy: result.rows[0] || null });
  } catch (err) {
    console.error('Policy active error:', err.message);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

router.patch('/toggle-pause', authMiddleware, async (req, res) => {
  try {
    const p = await query(req.db, `SELECT * FROM policies WHERE rider_id=? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1`, [req.rider_id]);
    if (!p.rows.length) return res.status(404).json({ error: 'No active policy' });
    const newStatus = p.rows[0].status === 'active' ? 'paused' : 'active';
    await query(req.db, `UPDATE policies SET status=? WHERE id=?`, [newStatus, p.rows[0].id]);
    saveDB();
    res.json({ success: true, status: newStatus });
  } catch (err) { res.status(500).json({ error: 'Toggle failed' }); }
});

router.patch('/cancel', authMiddleware, async (req, res) => {
  try {
    await query(req.db, `UPDATE policies SET status='cancelled' WHERE rider_id=? AND status != 'cancelled'`, [req.rider_id]);
    saveDB();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Cancel failed' }); }
});

function getNextMonday() {
  const d = new Date();
  const diff = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

module.exports = router;