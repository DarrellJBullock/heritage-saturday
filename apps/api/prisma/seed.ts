import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Auth is a stub in Capability 1: the API trusts an `x-user-id` header and every
// downstream FK (rosters, imports, games) requires that User row to already exist.
// These ids are therefore contract, not sample data — `dev-user-1` is hardcoded by
// apps/web, and the e2e suite drives the API as qa-user-a / qa-user-b to prove
// private-by-default ownership.
const USERS = [
  { id: 'dev-user-1', email: 'dev@heritage-saturday.local' },
  { id: 'qa-user-a', email: 'qa-a@heritage-saturday.local' },
  { id: 'qa-user-b', email: 'qa-b@heritage-saturday.local' },
];

async function main() {
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: user,
    });
    console.log(`  seeded user ${user.id} <${user.email}>`);
  }
  console.log(`Seed complete: ${USERS.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
