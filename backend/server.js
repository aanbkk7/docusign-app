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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/signed', express.static(path.join(__dirname, 'signed')));

app.use('/api/documents', require('./routes/documents'));
app.use('/api/sign', require('./routes/signing'));

// Let the frontend know the local IP for building signing links
app.get('/api/local-ip', (req, res) => {
  res.json({ ip: LOCAL_IP, frontendUrl: `http://${LOCAL_IP}:5173` });
});

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
