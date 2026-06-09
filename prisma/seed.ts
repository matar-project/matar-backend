import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@matar.org';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@1234!';
  const ADMIN_NAME = process.env.ADMIN_NAME ?? 'مدير النظام';

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
    },
  });

  console.log(`Admin user ready: id=${admin.id} email=${admin.email}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
