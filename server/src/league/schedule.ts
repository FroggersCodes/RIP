/**
 * Circle-method round robin. Returns the [home, away] pairings for a given week.
 * Week numbers beyond (teams-1) cycle, so the league always has a schedule.
 */
export function roundRobinWeek(teamIds: string[], weekNumber: number): [string, string][] {
  const n = teamIds.length;
  if (n < 2) return [];
  const fixed = teamIds[0]!;
  const rotating = teamIds.slice(1);
  const rot = (weekNumber - 1) % (n - 1);
  const rotated = rotating.slice(rot).concat(rotating.slice(0, rot));
  const round = [fixed, ...rotated];
  const pairs: [string, string][] = [];
  for (let i = 0; i < n / 2; i++) {
    const home = round[i]!;
    const away = round[n - 1 - i]!;
    // Alternate home/away by week for a touch of balance.
    pairs.push(weekNumber % 2 === 0 ? [away, home] : [home, away]);
  }
  return pairs;
}
