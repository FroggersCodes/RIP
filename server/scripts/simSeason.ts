import { advanceWeek } from '../src/league/advanceWeek';
import { prisma } from '../src/prisma';

// Dev helper: simulate N weeks (default 17 = a full season incl. playoffs).
const n = Number(process.argv[2] ?? 17);

for (let i = 0; i < n; i++) {
  const r = await advanceWeek();
  const tag = `S${r.season} W${String(r.weekNumber).padStart(2, ' ')} ${r.phaseLabel.padEnd(13)}`;
  const champ = r.champion ? `  🏆 ${r.champion.team} def. ${r.champion.runnerUp}` : '';
  console.log(`${tag} | ${r.featured?.recap ?? ''}${champ}`);
}
await prisma.$disconnect();
