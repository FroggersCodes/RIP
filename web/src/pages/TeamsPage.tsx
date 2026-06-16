import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import type { TeamSummary } from '../api/types';

export function TeamsPage() {
  const nav = useNavigate();
  const { data, loading } = useApi(() => api<{ teams: TeamSummary[] }>('/teams'), []);

  const byConf = new Map<string, TeamSummary[]>();
  for (const t of data?.teams ?? []) {
    const arr = byConf.get(t.conference) ?? [];
    arr.push(t);
    byConf.set(t.conference, arr);
  }

  return (
    <>
      <div className="page-head">
        <h1>The league</h1>
        <p>16 teams across two conferences. Tap a team to see its top players, values, and trends.</p>
      </div>

      {loading ? (
        <div className="center" style={{ padding: 60 }}>
          <div className="spin" />
        </div>
      ) : (
        [...byConf.entries()].map(([conf, teams]) => (
          <div key={conf}>
            <div className="conf-title">{conf} Conference</div>
            <div className="team-grid">
              {teams.map((t) => (
                <div
                  key={t.id}
                  className="team-tile"
                  onClick={() => nav(`/teams/${t.id}`)}
                  style={{ borderColor: 'var(--line)' }}
                >
                  <span className="team-stripe" style={{ background: t.primaryColor }} />
                  <div className="team-abbr" style={{ color: t.primaryColor }}>
                    {t.abbreviation}
                  </div>
                  <div className="team-name">{t.name}</div>
                  <div className="team-meta">
                    {t.conference} · {t.division} · {t.playerCount} players
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
