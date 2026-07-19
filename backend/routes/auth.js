const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { safeCompare } = require('../middleware/requireSenderAuth');

const router = express.Router();

// POST /api/auth/login — checks the password and, if correct, the client
// just keeps re-sending that same password as a Bearer token on every
// subsequent sender request (see requireSenderAuth). There's no separate
// session/token to issue or expire: one shared password, one sender.
router.post('/login', asyncHandler(async (req, res) => {
  const password = process.env.SENDER_PASSWORD;
  if (!password) {
    return res.status(500).json({ error: 'SENDER_PASSWORD is not configured on the server' });
  }
  const { password: provided } = req.body;
  if (!provided || !safeCompare(provided, password)) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }
  res.json({ ok: true });
}));

module.exports = router;
