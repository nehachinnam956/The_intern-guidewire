const router = require('express').Router();

// Create order - no auth needed, always demo mode
router.post('/create-order', async (req, res) => {
  const { amount } = req.body;
  return res.json({
    demo: true,
    order_id: `demo_order_${Date.now()}`,
    amount: (amount || 0) * 100,
    currency: 'INR',
    key: 'demo_key'
  });
});

// Verify payment - no auth needed, always success
router.post('/verify', async (req, res) => {
  return res.json({ 
    success: true, 
    demo: true, 
    payment_id: `demo_pay_${Date.now()}` 
  });
});

module.exports = router;