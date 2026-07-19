const express = require('express');
const path = require('path');
const fs = require('fs');
const prisma = require('../prisma');
const { finalizeDocument } = require('../services/pdfService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/sign/:token — what this specific recipient needs to see/sign
router.get('/:token', asyncHandler(async (req, res) => {
  const recipient = await prisma.recipient.findUnique({
    where: { signingToken: req.params.token },
    include: {
      document: {
        include: { fields: true, recipients: { select: { id: true, name: true, color: true } } },
      },
    },
  });
  if (!recipient) return res.status(404).json({ error: 'Document not found or link expired' });

  const doc = recipient.document;

  if (recipient.status === 'SIGNED') {
    return res.json({ status: 'signed', originalName: doc.originalName });
  }
  if (recipient.status === 'DECLINED' || doc.status === 'DECLINED') {
    return res.json({ status: 'declined', originalName: doc.originalName });
  }

  if (recipient.status === 'PENDING') {
    await prisma.recipient.update({ where: { id: recipient.id }, data: { status: 'VIEWED', viewedAt: new Date() } });
    await auditService.logEvent(req, { documentId: doc.id, recipientId: recipient.id, event: 'viewed' });
  }

  res.json({
    id: doc.id,
    originalName: doc.originalName,
    status: doc.status,
    fileUrl: `/uploads/${doc.filePath}`,
    recipient: { id: recipient.id, name: recipient.name, color: recipient.color },
    recipients: doc.recipients,
    // Every field is sent so the signer can see (grayed out) where others
    // still need to sign, but only fields owned by this recipient are
    // interactive on the client.
    fields: doc.fields.map(f => ({
      id: f.id,
      recipientId: f.recipientId,
      type: f.type,
      page: f.page,
      xPct: f.xPct,
      yPct: f.yPct,
      widthPct: f.widthPct,
      heightPct: f.heightPct,
      label: f.label,
      required: f.required,
    })),
  });
}));

// POST /api/sign/:token — submit this recipient's field values
// body: { values: { [fieldId]: dataUrlOrText } }
router.post('/:token', asyncHandler(async (req, res) => {
  const recipient = await prisma.recipient.findUnique({
    where: { signingToken: req.params.token },
    include: { document: { include: { fields: true, recipients: true } } },
  });
  if (!recipient) return res.status(404).json({ error: 'Not found' });
  if (recipient.status === 'SIGNED') return res.status(400).json({ error: 'Already signed' });

  const doc = recipient.document;
  const myFields = doc.fields.filter(f => f.recipientId === recipient.id);
  const values = req.body.values || {};

  const missing = myFields.filter(f => f.required && !values[f.id]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `${missing.length} field(s) not completed yet` });
  }

  await prisma.$transaction(
    myFields
      .filter(f => values[f.id])
      .map(f => {
        const isImage = typeof values[f.id] === 'string' && values[f.id].startsWith('data:image');
        return prisma.signatureField.update({
          where: { id: f.id },
          data: {
            valueImage: isImage ? values[f.id] : null,
            valueText: isImage ? null : values[f.id],
            signedAt: new Date(),
          },
        });
      })
  );

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { status: 'SIGNED', signedAt: new Date() },
  });

  await auditService.logEvent(req, {
    documentId: doc.id,
    recipientId: recipient.id,
    event: 'signed',
    metadata: { fieldIds: myFields.map(f => f.id) },
  });

  const allRecipients = await prisma.recipient.findMany({ where: { documentId: doc.id } });
  const allSigned = allRecipients.every(r => r.status === 'SIGNED');

  if (!allSigned) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: 'PARTIALLY_SIGNED' } });
    return res.json({ ok: true, allSigned: false, originalName: doc.originalName });
  }

  // Last signer just finished — flatten every signature into the PDF,
  // append the audit certificate, lock it, and persist the final artifact.
  const allFields = await prisma.signatureField.findMany({ where: { documentId: doc.id } });
  const auditEvents = await auditService.getTrail(doc.id);

  const pdfPath = path.join(__dirname, '../uploads', doc.filePath);
  const signedBytes = await finalizeDocument({
    pdfPath,
    fields: allFields,
    recipients: allRecipients,
    auditEvents,
    documentName: doc.originalName,
  });

  const signedFileName = `signed_${doc.filePath}`;
  fs.writeFileSync(path.join(__dirname, '../signed', signedFileName), signedBytes);

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'SIGNED', signedFilePath: signedFileName, completedAt: new Date() },
  });

  // Deliberately no download link in this response — a recipient's access
  // ends at signing. Only the sender can retrieve the finished PDF, via the
  // authenticated GET /api/documents/:id/download.
  res.json({
    ok: true,
    allSigned: true,
    originalName: doc.originalName,
  });
}));

// POST /api/sign/:token/decline — recipient refuses to sign
router.post('/:token/decline', asyncHandler(async (req, res) => {
  const recipient = await prisma.recipient.findUnique({ where: { signingToken: req.params.token } });
  if (!recipient) return res.status(404).json({ error: 'Not found' });

  await prisma.recipient.update({ where: { id: recipient.id }, data: { status: 'DECLINED' } });
  await prisma.document.update({ where: { id: recipient.documentId }, data: { status: 'DECLINED' } });
  await auditService.logEvent(req, {
    documentId: recipient.documentId,
    recipientId: recipient.id,
    event: 'declined',
    metadata: { reason: req.body.reason || null },
  });

  res.json({ ok: true });
}));

module.exports = router;
