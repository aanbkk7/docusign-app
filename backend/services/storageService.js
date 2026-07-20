const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Cloudflare R2 speaks the S3 API, so the regular AWS SDK works against it —
// just point the endpoint at the account's R2 URL. This replaces writing
// PDFs to the server's local disk, which on Render's free tier is
// ephemeral and gets wiped whenever the instance restarts (that's exactly
// what deleted a live, in-progress 17-recipient document).
function getClient() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'Cloudflare R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
      'R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME to backend/.env.'
    );
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function getBucket() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME is not set in backend/.env');
  return bucket;
}

async function uploadObject(key, buffer, contentType = 'application/pdf') {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

async function getObject(key) {
  const client = getClient();
  const result = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  const chunks = [];
  for await (const chunk of result.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function deleteObject(key) {
  const client = getClient();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  } catch {
    // Best-effort — don't block a document delete on storage cleanup failing.
  }
}

module.exports = { uploadObject, getObject, deleteObject };
