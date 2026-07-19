require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// Exposed so routes can build correct signing URLs
const LOCAL_IP = getLocalIP();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust X-Forwarded-* headers (ngrok / reverse proxies) so req.ip resolves to
// the real client IP — the audit trail depends on this being accurate.
app.set('trust proxy', true);

// Ensure required directories exist
['uploads', 'signed'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
// Original (unsigned) PDFs stay unauthenticated — a recipient's signing
// page needs to fetch/render one without ever having a sender password.
// The *signed* PDFs are intentionally NOT statically served: they're only
// reachable through GET /api/documents/:id/download, which sits behind
// requireSenderAuth (see routes/documents.js) — recipients can sign and
// submit, nothing else.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/sign', require('./routes/signing'));

// Let the frontend know the local IP for building signing links
app.get('/api/local-ip', (req, res) => {
  res.json({ ip: LOCAL_IP, frontendUrl: `http://${LOCAL_IP}:5173` });
});

// In production there's no separate Vite dev server — this same process
// serves the built React app too, so one deployed service (e.g. one Render
// web service) is enough and there's no cross-origin API to configure.
// Locally, frontend/dist won't exist (you run `vite` separately on :5173),
// so this block is simply skipped.
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Final safety net: every route above is wrapped in asyncHandler, so any
// thrown/rejected error lands here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`📱 Network (mobile): http://${LOCAL_IP}:${PORT}`);
  console.log(`🌐 App: http://${LOCAL_IP}:5173`);
});
