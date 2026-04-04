// admin.js
const router = require('express').Router();
const { query } = require('../db');

router.get('/stats', async (req, res) => {
  try {
    const riders = await query(req.db, `SELECT COUNT(*) as total FROM riders`);
    const policies = await query(req.db, `SELECT status, COUNT(*) as total FROM policies GROUP BY status`);
    const claims = await query(req.db, `SELECT status, COUNT(*) as total FROM claims GROUP BY status`);
    const payout = await query(req.db, `SELECT COALESCE(SUM(payout_amount),0) as total FROM claims WHERE status='approved'`);
    res.json({ total_riders: riders.rows[0].total, policies: policies.rows, claims: claims.rows, total_payout: payout.rows[0].total });
  } catch(err) { res.status(500).json({ error: 'Stats failed' }); }
});

router.get('/loss-ratios', async (req, res) => {
  try {
    const result = await query(req.db, `
      SELECT ds.name, ds.city, ds.risk_label,
        COUNT(DISTINCT p.rider_id) as riders,
        COALESCE(SUM(p.weekly_premium),0) as total_premium,
        COALESCE(SUM(c.payout_amount),0) as total_payout,
        COUNT(c.id) as claim_count,
        CASE WHEN SUM(p.weekly_premium) > 0
          THEN ROUND((CAST(SUM(c.payout_amount) AS REAL)/SUM(p.weekly_premium))*100,1)
          ELSE 0 END as loss_ratio_pct
      FROM dark_stores ds
      LEFT JOIN policies p ON p.store_id = ds.id
      LEFT JOIN claims c ON c.store_id = ds.id AND c.status='approved'
      GROUP BY ds.id ORDER BY loss_ratio_pct DESC
    `);
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: 'Loss ratio failed', detail: err.message }); }
});

router.get('/fraud-queue', async (req, res) => {
  try {
    const result = await query(req.db, `
      SELECT c.*, r.name as rider_name, r.phone, r.partner_id, ds.name as store_name
      FROM claims c JOIN riders r ON r.id = c.rider_id JOIN dark_stores ds ON ds.id = c.store_id
      WHERE c.status='manual_review' ORDER BY c.created_at DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: 'Fraud queue failed' }); }
});

router.patch('/claim/:id', async (req, res) => {
  const { status, rejection_reason } = req.body;
  try {
    await query(req.db, `UPDATE claims SET status=?, rejection_reason=?, resolved_at=datetime('now') WHERE id=?`, [status, rejection_reason||null, req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: 'Update failed' }); }
});

module.exports = router;
