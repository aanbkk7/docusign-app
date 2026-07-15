const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendSigningRequest({ to, documentName, signingUrl, fromName, signerName }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email not configured. Add SMTP_USER and SMTP_PASS to backend/.env');
  }

  const transport = createTransport();

  await transport.sendMail({
    from: `"${fromName || 'Document Signing'}" <${process.env.SMTP_USER}>`,
    to,
    subject: `בקשה לחתימה על מסמך: ${documentName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">בקשה לחתימה דיגיטלית</h2>
        <p>שלום ${signerName || ''},</p>
        <p>התבקשת לחתום על המסמך: <strong>${documentName}</strong></p>
        <p>לחץ על הכפתור למטה כדי לפתוח את המסמך ולחתום:</p>
        <a href="${signingUrl}"
           style="display:inline-block; background:#2563eb; color:white; padding:14px 28px;
                  border-radius:8px; text-decoration:none; font-size:16px; margin:20px 0;">
          חתום על המסמך
        </a>
        <p style="color:#666; font-size:13px;">הקישור תקף ל-7 ימים.</p>
      </div>
    `,
  });
}

module.exports = { sendSigningRequest };
