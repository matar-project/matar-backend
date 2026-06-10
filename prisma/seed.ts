import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL is not set');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@matar.org';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '12345678';
  const ADMIN_NAME = process.env.ADMIN_NAME ?? 'مدير النظام';

  const COORDINATOR_EMAIL =
    process.env.COORDINATOR_EMAIL ?? 'coordinator@matar.org';
  const COORDINATOR_PASSWORD = process.env.COORDINATOR_PASSWORD ?? '12345678';
  const COORDINATOR_NAME = process.env.COORDINATOR_NAME ?? 'منسق النظام';

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });
  const coordinatorRole = await prisma.role.upsert({
    where: { name: 'coordinator' },
    update: {},
    create: { name: 'coordinator' },
  });

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
    },
  });

  console.log(`Admin user ready: id=${admin.id} email=${admin.email}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);

  const coordinatorPasswordHash = await bcrypt.hash(COORDINATOR_PASSWORD, 12);

  const coordinator = await prisma.user.upsert({
    where: { email: COORDINATOR_EMAIL },
    update: { roleId: coordinatorRole.id },
    create: {
      name: COORDINATOR_NAME,
      email: COORDINATOR_EMAIL,
      passwordHash: coordinatorPasswordHash,
      roleId: coordinatorRole.id,
    },
  });

  console.log(
    `Coordinator user ready: id=${coordinator.id} email=${coordinator.email}`,
  );
  console.log(`Password: ${COORDINATOR_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
