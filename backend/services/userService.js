const prisma = require('../prisma');

// This app has no login flow yet — everything is prepared/sent by a single
// local account. Swap this for real auth (sessions/JWT) without touching the
// rest of the schema: every Document already has an ownerId foreign key.
const DEFAULT_USER_EMAIL = 'local@sender.app';

let cachedUserId = null;

async function getDefaultUser() {
  if (cachedUserId) return cachedUserId;
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: 'Local Sender' },
  });
  cachedUserId = user.id;
  return cachedUserId;
}

module.exports = { getDefaultUser };
