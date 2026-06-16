import { prisma } from '../src/prisma';
import { seed } from './seed';

// Safe to run on every deploy: only seeds when the database is empty, so it
// never wipes a live database on a restart/redeploy.
async function main() {
  const teams = await prisma.team.count();
  if (teams > 0) {
    console.log(`Database already has ${teams} teams; skipping seed.`);
    return;
  }
  console.log('Empty database detected — seeding...');
  await seed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
