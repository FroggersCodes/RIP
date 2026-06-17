import { createApp } from './http/app';
import { env } from './env';
import { maybeAdvance } from './league/clock';

const app = createApp();
app.listen(env.port, () => {
  console.log(`RIP server listening on http://localhost:${env.port}`);
});

// Live league clock: advance the season automatically when the cadence elapses.
// Idempotent, so the GitHub cron tick can also drive it on sleepy hosts.
const tick = () =>
  maybeAdvance()
    .then((r) => {
      if (r.advanced) console.log(`[clock] advanced league -> season ${r.result?.nextSeason} week ${r.result?.nextWeekNumber}`);
    })
    .catch((e) => console.error('[clock] tick error:', e));

setTimeout(tick, 5_000);
setInterval(tick, 60_000);
