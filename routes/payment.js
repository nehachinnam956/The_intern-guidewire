const router = require('express').Router();

router.post('/create-order', async (req, res) => {
  const { amount } = req.body;
  return res.json({ demo: true, order_id: `demo_order_${Date.now()}`, amount: (amount||0)*100, currency: 'INR', key: 'demo_key' });
});

router.post('/verify', async (req, res) => {
  return res.json({ success: true, demo: true, payment_id: `demo_pay_${Date.now()}` });
});

module.exports = router;
