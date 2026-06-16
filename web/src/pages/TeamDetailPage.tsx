import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { ValueSparkline } from '../components/ValueSparkline';
import { money, signed } from '../lib/format';
import type { TeamDetail } from '../api/types';

export function TeamDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading } = useApi(() => api<TeamDetail>(`/teams/${id}`), [id]);

  if (loading || !data) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <div className="spin" />
      </div>
    );
  }
  const { team, topPlayers } = data;

  return (
    <>
      <Link to="/teams" className="back-link">
        ← All teams
      </Link>
      <div
        className="team-banner"
        style={{
          background: `linear-gradient(120deg, ${team.primaryColor}33, var(--surface) 55%)`,
          borderColor: team.primaryColor,
        }}
      >
        <div className="row" style={{ gap: 14 }}>
          <div className="team-abbr" style={{ fontSize: 40, color: team.primaryColor }}>
            {team.abbreviation}
          </div>
          <div>
            <h1>{team.name}</h1>
            <div className="muted">
              {team.conference} Conference · {team.division} Division
            </div>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginBottom: 10 }}>
        Top players
      </div>
      <div className="player-list">
        {topPlayers.map((p, i) => (
          <div className="player-row" key={p.id} onClick={() => nav(`/players/${p.id}`)}>
            <span className="pr-rank">{i + 1}</span>
            <div>
              <div className="pr-name">
                {p.name} {p.isTopPlayer && <span className="gold">★</span>}
              </div>
              <div className="pr-sub">
                {p.position} · OVR {p.overallRating}
                {p.lastWeek ? ` · last wk ${p.lastWeek.fantasyPoints.toFixed(1)} pts` : ' · DNP'}
              </div>
            </div>
            <ValueSparkline points={p.valueTrend.map((v) => v.value)} />
            <div style={{ minWidth: 64, textAlign: 'right' }}>
              {p.valueTrend.length > 0 && (
                <div
                  className={`mono ${p.valueTrend[p.valueTrend.length - 1]!.delta >= 0 ? 'up' : 'down'}`}
                  style={{ fontSize: 12 }}
                >
                  {signed(p.valueTrend[p.valueTrend.length - 1]!.delta)}
                </div>
              )}
            </div>
            <div className="pr-val">{money(p.currentValue)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
