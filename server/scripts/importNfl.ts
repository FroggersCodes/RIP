import { importNflData } from '../src/data/importNfl';
import { prisma } from '../src/prisma';

importNflData(process.env.NFL_SEASON)
  .then((s) => {
    console.log('Import complete:', s);
    console.log('Note: real photos are licensed — players show monograms.');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
