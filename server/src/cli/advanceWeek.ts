import { advanceWeek } from '../league/advanceWeek';
import { prisma } from '../prisma';

advanceWeek()
  .then((r) => {
    console.log(`Simulated season ${r.season}, week ${r.weekNumber} — ${r.phaseLabel}.`);
    console.log(`  games: ${r.gamesPlayed}  stats: ${r.statsRecorded}  revalued: ${r.playersRevalued}  lineups: ${r.lineupsScored}`);
    if (r.featured) console.log(`  game of the week: ${r.featured.recap}`);
    if (r.champion) console.log(`  🏆 CHAMPION: ${r.champion.team} (def. ${r.champion.runnerUp}). New season begins.`);
    console.log(`  top movers:`);
    for (const m of r.topMovers) {
      console.log(`    ${m.delta >= 0 ? '+' : ''}${m.delta}  ${m.name} (${m.teamAbbr}) -> $${m.valueAfter}`);
    }
    console.log(`  current week is now season ${r.nextSeason}, week ${r.nextWeekNumber}.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
