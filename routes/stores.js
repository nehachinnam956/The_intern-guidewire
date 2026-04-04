const router = require('express').Router();
const { query } = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await query(req.db, `SELECT * FROM dark_stores ORDER BY city, name`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch stores' }); }
});

// ── MUST be before /:id ──
router.post('/calculate-premium', async (req, res) => {
  const { store_id, shift_pattern, tenure_months } = req.body;
  try {
    const store = await query(req.db, `SELECT * FROM dark_stores WHERE id=?`, [store_id]);
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    const s = store.rows[0];
    const cityBase = ['Bengaluru','Mumbai'].includes(s.city) ? 28 : s.city === 'Delhi' ? 30 : 22;
    const shiftMult = shift_pattern === 'evening' ? 1.35 : shift_pattern === 'both' ? 1.40 : 1.00;
    const tenureDisc = tenure_months >= 6 ? 0.80 : tenure_months >= 3 ? 0.90 : 1.00;
    const premium = Math.round(cityBase * s.risk_score * shiftMult * tenureDisc);
    res.json({
      premium, max_coverage: 4250,
      breakdown: { city_base: cityBase, store_risk: s.risk_score, risk_label: s.risk_label, shift_multiplier: shiftMult, tenure_discount: tenureDisc }
    });
  } catch (err) { res.status(500).json({ error: 'Premium calculation failed' }); }
});

// ── MUST be after /calculate-premium ──
router.get('/:id', async (req, res) => {
  try {
    const store = await query(req.db, `SELECT * FROM dark_stores WHERE id=?`, [req.params.id]);
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    res.json(store.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch store' }); }
});

module.exports = router;