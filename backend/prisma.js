const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./generated/prisma');

// Driver-adapter setup (required by Prisma 7's "client" engine — no more
// bundled query-engine binary talking directly to a connection string).
// Works unchanged against any standard Postgres — a local install, Docker,
// or a managed free-tier provider like Neon/Supabase — just point
// DATABASE_URL at it.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to backend/.env — e.g. a free Postgres ' +
    'connection string from https://neon.tech.'
  );
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
