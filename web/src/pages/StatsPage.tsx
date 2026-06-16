import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import type { SeasonLeaders, StatCategory, WeeklyLeaders } from '../api/types';

function LeaderCard({ cat }: { cat: StatCategory }) {
  return (
    <div className="panel panel-p">
      <div className="section-title" style={{ marginBottom: 8 }}>
        {cat.label}
      </div>
      {cat.leaders.length === 0 ? (
        <div className="muted">No data yet.</div>
      ) : (
        <div>
          {cat.leaders.map((l, i) => (
            <Link to={`/players/${l.id}`} className="lead-row" key={l.id + i}>
              <span className="lead-rank">{i + 1}</span>
              <span className="lead-name">
                {l.name} <span className="muted">{l.position} · {l.team}</span>
              </span>
              <span className="lead-val mono">
                {l.value} {cat.unit}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatsPage() {
  const weekly = useApi(() => api<WeeklyLeaders>('/league/leaders'), []);
  const season = useApi(() => api<SeasonLeaders>('/league/stat-leaders'), []);

  return (
    <>
      <div className="page-head">
        <h1>Stat leaders</h1>
        <p>Top performers from the simulated league — tap a name for the full player page.</p>
      </div>

      <div className="section-title" style={{ marginBottom: 10 }}>
        This week{weekly.data?.week ? ` · week ${weekly.data.week.weekNumber}` : ''}
      </div>
      {weekly.loading ? (
        <div className="center" style={{ padding: 30 }}>
          <div className="spin" />
        </div>
      ) : (
        <div className="leader-grid">
          {weekly.data?.categories.map((c) => (
            <LeaderCard key={c.label} cat={c} />
          ))}
        </div>
      )}

      <div className="section-title" style={{ margin: '24px 0 10px' }}>
        Season totals{season.data ? ` · season ${season.data.season}` : ''}
      </div>
      {season.loading ? (
        <div className="center" style={{ padding: 30 }}>
          <div className="spin" />
        </div>
      ) : (
        <div className="leader-grid">
          {season.data?.categories.map((c) => (
            <LeaderCard key={c.label} cat={c} />
          ))}
        </div>
      )}
    </>
  );
}
