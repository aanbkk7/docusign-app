const prisma = require('../prisma');

// Best-effort real client IP: respect X-Forwarded-For when behind a proxy/
// tunnel (ngrok, nginx, a load balancer), otherwise fall back to the socket.
// server.js sets `app.set('trust proxy', true)` so req.ip already resolves
// this, but we keep the header check as a defensive fallback.
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function logEvent(req, { documentId, recipientId, event, metadata }) {
  return prisma.auditEvent.create({
    data: {
      documentId,
      recipientId: recipientId || null,
      event,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function getTrail(documentId) {
  return prisma.auditEvent.findMany({
    where: { documentId },
    include: { recipient: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

module.exports = { logEvent, getTrail, getClientIp };
