import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import type { Bracket, BracketGame, ChampionRow, Standings } from '../api/types';

function BracketCol({ title, games }: { title: string; games: BracketGame[] }) {
  return (
    <div className="panel panel-p">
      <div className="section-title" style={{ marginBottom: 10 }}>
        {title}
      </div>
      {games.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          TBD
        </div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {games.map((g, i) => {
            const homeWon = g.played && g.homeScore >= g.awayScore;
            const awayWon = g.played && g.awayScore > g.homeScore;
            return (
              <div className="bracket-game" key={i}>
                <div className={`bg-row ${homeWon ? 'bg-win' : ''}`}>
                  <span>
                    {g.homeSeed && <span className="bg-seed">{g.homeSeed}</span>} {g.home}
                  </span>
                  <span className="mono">{g.played ? g.homeScore : '—'}</span>
                </div>
                <div className={`bg-row ${awayWon ? 'bg-win' : ''}`}>
                  <span>
                    {g.awaySeed && <span className="bg-seed">{g.awaySeed}</span>} {g.away}
                  </span>
                  <span className="mono">{g.played ? g.awayScore : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StandingsPage() {
  const standings = useApi(() => api<Standings>('/league/standings'), []);
  const bracket = useApi(() => api<Bracket>('/league/bracket'), []);
  const history = useApi(() => api<{ seasons: ChampionRow[] }>('/league/history'), []);

  const hasBracket =
    bracket.data &&
    (bracket.data.rounds.QF.length || bracket.data.rounds.SF.length || bracket.data.rounds.FINAL.length);

  return (
    <>
      <div className="page-head">
        <h1>Standings</h1>
        <p>Top 8 make the playoffs. Seeded by wins, then point differential.{standings.data ? ` Season ${standings.data.season}.` : ''}</p>
      </div>

      {standings.loading ? (
        <div className="center" style={{ padding: 40 }}>
          <div className="spin" />
        </div>
      ) : (
        <div className="panel" style={{ overflow: 'hidden', marginBottom: 18 }}>
          <table className="lb-table">
            <thead>
              <tr>
                <th className="lb-rank">#</th>
                <th>Team</th>
                <th style={{ textAlign: 'right' }}>W-L-T</th>
                <th style={{ textAlign: 'right' }}>PF</th>
                <th style={{ textAlign: 'right' }}>PA</th>
                <th style={{ textAlign: 'right' }}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.data?.standings.map((t) => (
                <tr key={t.teamId} className={t.playoffSeed ? 'lb-me' : ''}>
                  <td className="lb-rank">{t.playoffSeed ?? t.rank}</td>
                  <td>
                    <b>{t.abbreviation}</b> <span className="muted">{t.name}</span>
                    {t.playoffSeed && <span className="seed-chip">playoff</span>}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {t.wins}-{t.losses}
                    {t.ties ? `-${t.ties}` : ''}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{t.pointsFor}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{t.pointsAgainst}</td>
                  <td className={`mono ${t.diff >= 0 ? 'up' : 'down'}`} style={{ textAlign: 'right' }}>
                    {t.diff >= 0 ? '+' : ''}
                    {t.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasBracket ? (
        <>
          <div className="section-title" style={{ marginBottom: 10 }}>
            Playoff bracket
          </div>
          <div className="bracket" style={{ marginBottom: 18 }}>
            <BracketCol title="Quarterfinals" games={bracket.data!.rounds.QF} />
            <BracketCol title="Semifinals" games={bracket.data!.rounds.SF} />
            <BracketCol title="Championship" games={bracket.data!.rounds.FINAL} />
          </div>
        </>
      ) : null}

      <div className="section-title" style={{ marginBottom: 10 }}>
        Champions
      </div>
      {history.data && history.data.seasons.length > 0 ? (
        <div className="panel" style={{ overflow: 'hidden' }}>
          <table className="lb-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Champion</th>
                <th>Runner-up</th>
                <th>Top manager</th>
              </tr>
            </thead>
            <tbody>
              {history.data.seasons.map((c) => (
                <tr key={c.season}>
                  <td className="mono">S{c.season}</td>
                  <td>
                    <span className="gold">🏆 {c.champion}</span> <span className="muted">({c.championAbbr})</span>
                  </td>
                  <td className="muted">{c.runnerUpAbbr}</td>
                  <td>
                    {c.topUser ? `${c.topUser} (${c.topUserPoints?.toFixed(0)} pts)` : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No seasons completed yet. Advance through a championship to crown one.</div>
      )}
    </>
  );
}
