const router = require('express').Router();

// Get all dark stores
router.get('/', async (req, res) => {
  try {
    const result = await req.db.query(`SELECT * FROM dark_stores ORDER BY city, name`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get single store with recent trigger events
router.get('/:id', async (req, res) => {
  try {
    const store = await req.db.query(`SELECT * FROM dark_stores WHERE id=$1`, [req.params.id]);
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });

    const events = await req.db.query(
      `SELECT * FROM trigger_events WHERE store_id=$1 AND threshold_breached=true ORDER BY checked_at DESC LIMIT 10`,
      [req.params.id]
    );
    res.json({ ...store.rows[0], recent_events: events.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

// Calculate premium for a store
router.post('/calculate-premium', async (req, res) => {
  const { store_id, shift_pattern, tenure_months, city } = req.body;
  try {
    const store = await req.db.query(`SELECT * FROM dark_stores WHERE id=$1`, [store_id]);
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });

    const s = store.rows[0];
    const cityBase = ['Bengaluru','Mumbai'].includes(s.city) ? 28 : s.city === 'Delhi' ? 30 : 22;
    const shiftMult = shift_pattern === 'evening' ? 1.35 : shift_pattern === 'both' ? 1.40 : 1.00;
    const tenureDisc = tenure_months >= 6 ? 0.80 : tenure_months >= 3 ? 0.90 : 1.00;
    const premium = Math.round(cityBase * s.risk_score * shiftMult * tenureDisc);
    const maxCoverage = Math.round(850 * 5);

    res.json({
      premium,
      max_coverage: maxCoverage,
      breakdown: {
        city_base: cityBase,
        store_risk: s.risk_score,
        risk_label: s.risk_label,
        shift_multiplier: shiftMult,
        tenure_discount: tenureDisc,
        formula: `₹${cityBase} × ${s.risk_score} × ${shiftMult} × ${tenureDisc} = ₹${premium}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Premium calculation failed' });
  }
});

module.exports = router;
