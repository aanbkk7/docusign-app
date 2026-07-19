const crypto = require('crypto');

// Constant-time string comparison — a plain `===` on secrets leaks timing
// information an attacker could use to guess the password character by
// character. crypto.timingSafeEqual requires equal-length buffers, so we
// guard the length check separately (that early-return is fine: it doesn't
// leak anything a length mismatch didn't already reveal).
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Everything the sender can do (list/upload/prepare/send/delete/download
// documents) lives behind this. The only route that must stay open without
// it is /api/sign/:token — a recipient's whole "login" is knowing that one
// unguessable token for their one document, they should never be able to
// reach anything else.
function requireSenderAuth(req, res, next) {
  const password = process.env.SENDER_PASSWORD;
  if (!password) {
    return res.status(500).json({ error: 'SENDER_PASSWORD is not configured on the server' });
  }

  const auth = req.headers['authorization'] || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!provided || !safeCompare(provided, password)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireSenderAuth, safeCompare };
