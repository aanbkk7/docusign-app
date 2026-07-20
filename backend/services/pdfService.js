const { PDFDocument, StandardFonts, rgb } = require('@cantoo/pdf-lib');
const crypto = require('crypto');

// Percentage coords (0-1, top-left origin) -> PDF points (bottom-left origin).
function pctToPoint(field, pageWidth, pageHeight) {
  return {
    x: field.xPct * pageWidth,
    y: (1 - field.yPct - field.heightPct) * pageHeight,
    width: field.widthPct * pageWidth,
    height: field.heightPct * pageHeight,
  };
}

async function embedFieldValues(pdfDoc, fields) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();
    const { x, y, width, height } = pctToPoint(field, pw, ph);

    if (field.valueImage) {
      const base64 = field.valueImage.replace(/^data:image\/png;base64,/, '');
      const pngImage = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
      page.drawImage(pngImage, { x, y, width, height });
    } else if (field.valueText) {
      const fontSize = Math.min(14, height * 0.7);
      page.drawText(field.valueText, {
        x: x + 2,
        y: y + (height - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
  }
}

// Appends a certificate-of-completion page: every recipient + every
// audit event (IP, user agent, timestamp) — the evidentiary trail that
// backs up "who signed what, from where, when."
async function appendAuditCertificatePage(pdfDoc, { documentName, recipients, auditEvents }) {
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 60;
  const left = 50;
  const lineHeight = 16;

  const drawLine = (text, opts = {}) => {
    page.drawText(text, {
      x: left,
      y,
      size: opts.size || 10,
      font: opts.bold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= opts.gap || lineHeight;
  };

  drawLine('Certificate of Completion — Audit Trail', { size: 16, bold: true, gap: 24 });
  drawLine(`Document: ${documentName}`, { bold: true });
  drawLine(`Generated: ${new Date().toISOString()}`);
  y -= 10;

  drawLine('Signers', { size: 12, bold: true, gap: 20 });
  for (const r of recipients) {
    drawLine(`${r.name}  <${r.email || r.phone || 'n/a'}>  —  ${r.status}${r.signedAt ? `  (signed ${new Date(r.signedAt).toISOString()})` : ''}`);
  }
  y -= 10;

  drawLine('Event Log', { size: 12, bold: true, gap: 20 });
  for (const e of auditEvents) {
    const who = e.recipient ? e.recipient.name : 'sender';
    const line = `${new Date(e.createdAt).toISOString()}  ·  ${e.event.toUpperCase()}  ·  ${who}  ·  IP ${e.ipAddress}`;
    drawLine(line, { size: 9 });
    drawLine(`    UA: ${e.userAgent}`, { size: 8, gap: lineHeight + 2 });
    if (y < 60) {
      y = height - 60;
      pdfDoc.addPage();
    }
  }
}

// Encrypts the finished PDF so it can still be opened/read by anyone (no
// user password) but cannot be modified, form-filled, or reassembled without
// the owner password — which is generated at random and never handed out.
// This is the "lock from further editing" requirement; it does not replace
// a cryptographic digital signature (see README for that distinction).
function lockDocument(pdfDoc) {
  const ownerPassword = crypto.randomBytes(24).toString('hex');
  pdfDoc.encrypt({
    ownerPassword,
    userPassword: '',
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: true,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });
}

/**
 * Builds the final, signed, locked PDF for a document once every recipient
 * has completed their fields. Takes the original PDF as bytes (fetched by
 * the caller from wherever it's actually stored — R2, not local disk) so
 * this module has no dependency on the filesystem at all.
 */
async function finalizeDocument({ pdfBytes, fields, recipients, auditEvents, documentName }) {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  await embedFieldValues(pdfDoc, fields);
  await appendAuditCertificatePage(pdfDoc, { documentName, recipients, auditEvents });

  pdfDoc.setProducer('Digital Signature App');
  pdfDoc.setModificationDate(new Date());
  pdfDoc.setTitle(`${documentName} (signed)`);

  lockDocument(pdfDoc);

  return pdfDoc.save();
}

module.exports = { finalizeDocument };
