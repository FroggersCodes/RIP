import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import type { LeaderboardEntry } from '../api/types';

interface ScoreGame {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  played: boolean;
  round: string;
  isFeatured: boolean;
  homeSeed: number | null;
  awaySeed: number | null;
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const lb = useApi(() => api<{ week: { weekNumber: number } | null; entries: LeaderboardEntry[] }>('/league/leaderboard'), []);
  const sb = useApi(() => api<{ week: { weekNumber: number } | null; games: ScoreGame[] }>('/league/scoreboard'), []);

  return (
    <>
      <div className="page-head">
        <h1>Leaderboard</h1>
        <p>
          Weekly lineup scores from real simulated stats.
          {lb.data?.week ? ` Showing week ${lb.data.week.weekNumber}.` : ' No week simulated yet.'}
        </p>
      </div>

      <div className="home-cols" style={{ marginTop: 0 }}>
        <div className="panel panel-p">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Top lineups
          </div>
          {lb.loading ? (
            <div className="center" style={{ padding: 30 }}>
              <div className="spin" />
            </div>
          ) : (lb.data?.entries.length ?? 0) === 0 ? (
            <div className="empty">No lineup scores yet. Equip a lineup, then advance a week.</div>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-rank">#</th>
                  <th>Player</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {lb.data!.entries.map((e) => (
                  <tr key={e.rank} className={e.username === user?.username ? 'lb-me' : ''}>
                    <td className="lb-rank">{e.rank}</td>
                    <td>{e.username}</td>
                    <td className="lb-pts">{e.points.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel panel-p">
          <div className="section-title" style={{ marginBottom: 8 }}>
            Scoreboard{sb.data?.week ? ` · week ${sb.data.week.weekNumber}` : ''}
          </div>
          {(sb.data?.games.length ?? 0) === 0 ? (
            <div className="empty">No games simulated yet.</div>
          ) : (
            <div className="scoreboard">
              {sb.data!.games.map((g, i) => {
                const homeWin = g.homeScore >= g.awayScore;
                return (
                  <div className="score-row" key={i}>
                    <span className={homeWin ? '' : 'muted'}>
                      {g.isFeatured && <span title="Game of the week">★ </span>}
                      {g.homeSeed ? `(${g.homeSeed}) ` : ''}
                      {g.home} {g.homeScore}
                    </span>
                    <span className={!homeWin ? '' : 'muted'}>
                      {g.awayScore} {g.away}
                      {g.awaySeed ? ` (${g.awaySeed})` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
