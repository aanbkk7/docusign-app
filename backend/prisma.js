const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('./generated/prisma');

// Driver-adapter setup (required by Prisma 7's "client" engine — no more
// bundled query-engine binary talking directly to a connection string).
// Swap the adapter package + url below to move to Postgres in production,
// e.g. `@prisma/adapter-pg` with `DATABASE_URL=postgresql://...` — the
// schema.prisma models and every route in this app stay unchanged.
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
