const twilio = require('twilio');

function getClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('SMS not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER to backend/.env');
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

async function sendSigningRequestSms({ to, documentName, signingUrl }) {
  const client = getClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error('TWILIO_FROM_NUMBER is not set in backend/.env');

  await client.messages.create({
    from,
    to, // E.164 format, e.g. +972521234567
    body: `You've been asked to sign "${documentName}". Open and sign here: ${signingUrl}`,
  });
}

module.exports = { sendSigningRequestSms };
