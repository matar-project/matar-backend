// Reverses tmp-seed-prod.cjs — deletes ONLY the tagged demo data. Safe for real data.
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./dist/src/generated/prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

(async () => {
  console.log('Target DB host:', new URL(process.env.DATABASE_URL).host);
  // demo users by email pattern
  const demoUsers = await prisma.user.findMany({ where: { email: { startsWith: 'zz-' } }, select: { id: true } });
  const ids = demoUsers.map((u) => u.id);

  // requests created by demo users (cascades reservations + assignments)
  const demoReq = await prisma.request.findMany({ where: { OR: [{ title: { contains: '[DEMO]' } }, { createdByUserId: { in: ids } }] }, select: { id: true } });
  const reqIds = demoReq.map((r) => r.id);
  const r1 = await prisma.pageReservation.deleteMany({ where: { OR: [{ requestId: { in: reqIds } }, { volunteerId: { in: ids } }] } });
  const a1 = await prisma.requestVolunteerAssignment.deleteMany({ where: { OR: [{ requestId: { in: reqIds } }, { volunteerId: { in: ids } }] } });
  const li = await prisma.libraryItem.deleteMany({ where: { OR: [{ title: { contains: '[DEMO]' } }, { sourceRequestId: { in: reqIds } }] } });
  const rq = await prisma.request.deleteMany({ where: { id: { in: reqIds } } });
  const op = await prisma.opportunity.deleteMany({ where: { title: { contains: '[DEMO]' } } });
  const vd = await prisma.verificationDocument.deleteMany({ where: { userId: { in: ids } } });
  const rt = await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  const cb = await prisma.conversionBook.deleteMany({ where: { normalizedName: { startsWith: 'demo-' } } });
  const us = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log('Deleted:', JSON.stringify({ reservations: r1.count, assignments: a1.count, library: li.count, requests: rq.count, opportunities: op.count, verificationDocs: vd.count, refreshTokens: rt.count, conversionBooks: cb.count, users: us.count }, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
