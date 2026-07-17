const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../prisma');
const { getDefaultUser } = require('../services/userService');
const { finalizeDocument } = require('../services/pdfService');
const { sendSigningRequest } = require('../services/emailService');
const { sendSigningRequestSms } = require('../services/smsService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF and Word files are supported'));
  },
});

// GET /api/documents — list all documents for the (single, local) sender
router.get('/', asyncHandler(async (req, res) => {
  const ownerId = await getDefaultUser();
  const docs = await prisma.document.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { recipients: true, fields: true } } },
  });
  res.json(docs.map(d => ({
    id: d.id,
    originalName: d.originalName,
    status: d.status,
    createdAt: d.createdAt,
    recipientCount: d._count.recipients,
    fieldCount: d._count.fields,
  })));
}));

// POST /api/documents/upload — upload a PDF, creates a draft Document
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Fix Hebrew/UTF-8 filename encoding — multer on Windows reads as latin1
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

  const ext = path.extname(originalName).toLowerCase();
  if (ext !== '.pdf') {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      error: 'Please convert your Word file to PDF first. You can do this in Word: File → Save As → PDF.',
    });
  }

  const newPath = req.file.path + '.pdf';
  fs.renameSync(req.file.path, newPath);

  const ownerId = await getDefaultUser();
  const doc = await prisma.document.create({
    data: {
      ownerId,
      originalName,
      filePath: path.basename(newPath),
      status: 'DRAFT',
    },
  });

  res.json({ id: doc.id, originalName: doc.originalName });
}));

// GET /api/documents/:id — full detail: recipients + fields
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: {
      recipients: { orderBy: { routingOrder: 'asc' } },
      fields: true,
    },
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
}));

// GET /api/documents/:id/audit — the evidentiary trail
router.get('/:id/audit', asyncHandler(async (req, res) => {
  const trail = await auditService.getTrail(req.params.id);
  res.json(trail);
}));

// PUT /api/documents/:id/recipients — replace the recipient list
// body: { recipients: [{ id?, name, email?, phone?, color? }] }
router.put('/:id/recipients', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const incoming = req.body.recipients || [];
  const existing = await prisma.recipient.findMany({ where: { documentId: doc.id } });
  const existingIds = new Set(existing.map(r => r.id));
  const keepIds = new Set(incoming.filter(r => existingIds.has(r.id)).map(r => r.id));

  // Anyone removed from the list (and their fields) is dropped via cascade delete
  const toRemove = existing.filter(r => !keepIds.has(r.id));
  if (toRemove.length) {
    await prisma.recipient.deleteMany({ where: { id: { in: toRemove.map(r => r.id) } } });
  }

  const saved = [];
  for (const r of incoming) {
    // Client-side field placement generates a temporary "tmp_..." id before
    // the recipient has ever been persisted — only treat it as an update if
    // it's actually a row we already have.
    if (existingIds.has(r.id)) {
      saved.push(await prisma.recipient.update({
        where: { id: r.id },
        data: { name: r.name, email: r.email || null, phone: r.phone || null, color: r.color || '#2563eb' },
      }));
    } else {
      saved.push(await prisma.recipient.create({
        data: {
          documentId: doc.id,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          color: r.color || '#2563eb',
          signingToken: uuidv4(),
        },
      }));
    }
  }

  res.json(saved);
}));

// PUT /api/documents/:id/fields — replace all field placements
// body: { fields: [{ recipientId, type, page, xPct, yPct, widthPct, heightPct, label?, required? }] }
router.put('/:id/fields', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Not found' });

  const fields = req.body.fields || [];

  await prisma.$transaction([
    prisma.signatureField.deleteMany({ where: { documentId: doc.id } }),
    prisma.signatureField.createMany({
      data: fields.map(f => ({
        documentId: doc.id,
        recipientId: f.recipientId,
        type: f.type || 'SIGNATURE',
        page: f.page,
        xPct: f.xPct,
        yPct: f.yPct,
        widthPct: f.widthPct,
        heightPct: f.heightPct,
        label: f.label || null,
        required: f.required !== false,
      })),
    }),
    prisma.document.update({ where: { id: doc.id }, data: { status: 'DRAFT' } }),
  ]);

  res.json({ ok: true });
}));

// POST /api/documents/:id/send — email/SMS a unique signing link to every recipient
router.post('/:id/send', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { recipients: true, fields: true },
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.recipients.length === 0) return res.status(400).json({ error: 'Add at least one recipient first' });
  if (doc.fields.length === 0) return res.status(400).json({ error: 'Place at least one signature field first' });

  // In production PUBLIC_APP_URL is the one true origin for signing links —
  // it always wins, so a request can't redirect recipients to an arbitrary
  // domain by passing a spoofed frontendUrl. Locally, where there's no fixed
  // public URL yet, we still honor the client's choice (LAN IP or an ngrok
  // tunnel — see SendPage) so the existing dev workflow keeps working.
  const frontendUrl = process.env.PUBLIC_APP_URL || req.body.frontendUrl || 'http://localhost:5173';

  const results = [];
  for (const recipient of doc.recipients) {
    const signingUrl = `${frontendUrl}/sign/${recipient.signingToken}`;
    const result = { recipientId: recipient.id, name: recipient.name, signingUrl };

    let whatsappUrl = null;
    if (recipient.phone) {
      const cleanPhone = recipient.phone.replace(/\D/g, '');
      const msg = encodeURIComponent(`שלום ${recipient.name},\nהתבקשת לחתום על המסמך:\n"${doc.originalName}"\n\nלחץ על הקישור:\n${signingUrl}`);
      whatsappUrl = `https://wa.me/${cleanPhone}?text=${msg}`;
    }
    result.whatsappUrl = whatsappUrl;

    if (recipient.email) {
      try {
        await sendSigningRequest({ to: recipient.email, documentName: doc.originalName, signingUrl, signerName: recipient.name });
        result.emailSent = true;
      } catch (err) {
        result.emailSent = false;
        result.emailError = err.message;
      }
    }

    if (recipient.phone) {
      try {
        await sendSigningRequestSms({ to: recipient.phone, documentName: doc.originalName, signingUrl });
        result.smsSent = true;
      } catch (err) {
        result.smsSent = false;
        result.smsError = err.message;
      }
    }

    await auditService.logEvent(req, { documentId: doc.id, recipientId: recipient.id, event: 'sent' });
    results.push(result);
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'PENDING', sentAt: new Date() },
  });

  res.json({ results });
}));

// DELETE /api/documents/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Not found' });

  try { fs.unlinkSync(path.join(__dirname, '../uploads', doc.filePath)); } catch {}
  if (doc.signedFilePath) {
    try { fs.unlinkSync(path.join(__dirname, '../signed', doc.signedFilePath)); } catch {}
  }

  // Recipients, fields, and audit events cascade-delete via the schema
  await prisma.document.delete({ where: { id: doc.id } });

  res.json({ ok: true });
}));

module.exports = router;
