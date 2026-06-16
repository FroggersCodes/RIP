import { Link, useParams } from 'react-router-dom';
import { PARALLEL_MAP, type Position } from '@rip/shared';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { ValueSparkline } from '../components/ValueSparkline';
import { money } from '../lib/format';
import type { PlayerDetail } from '../api/types';

function statColumns(position: Position): { key: string; label: string }[] {
  if (position === 'QB')
    return [
      { key: 'passYds', label: 'Pass Yd' },
      { key: 'passTd', label: 'Pass TD' },
      { key: 'interceptions', label: 'INT' },
      { key: 'rushYds', label: 'Rush Yd' },
      { key: 'fantasyPoints', label: 'FPts' },
    ];
  if (position === 'RB')
    return [
      { key: 'rushYds', label: 'Rush Yd' },
      { key: 'rushTd', label: 'Rush TD' },
      { key: 'receptions', label: 'Rec' },
      { key: 'recYds', label: 'Rec Yd' },
      { key: 'fantasyPoints', label: 'FPts' },
    ];
  return [
    { key: 'receptions', label: 'Rec' },
    { key: 'recYds', label: 'Rec Yd' },
    { key: 'recTd', label: 'Rec TD' },
    { key: 'rushYds', label: 'Rush Yd' },
    { key: 'fantasyPoints', label: 'FPts' },
  ];
}

export function PlayerDetailPage() {
  const { id } = useParams();
  const { data, loading } = useApi(() => api<PlayerDetail>(`/players/${id}`), [id]);

  if (loading || !data) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <div className="spin" />
      </div>
    );
  }
  const { player, recentStats, valueHistory, parallels } = data;
  const cols = statColumns(player.position);
  const trend = valueHistory.map((v) => v.value);

  return (
    <>
      <Link to={`/teams/${player.team.id}`} className="back-link">
        ← {player.team.name}
      </Link>
      <div className="player-hero">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h1>{player.name}</h1>
            {player.isTopPlayer && <span className="gold" style={{ fontSize: 22 }}>★</span>}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {player.position} · {player.team.abbreviation} · OVR {player.overallRating}
          </div>
          <div className="kpi gold" style={{ fontSize: 34, marginTop: 12 }}>
            {money(player.currentValue)}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            base value · drives every card's price
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="section-title">Value trend</div>
          {trend.length >= 2 ? (
            <ValueSparkline points={trend} width={260} height={70} />
          ) : (
            <div className="muted" style={{ fontSize: 13, paddingTop: 20 }}>
              Advance a few weeks to chart this.
            </div>
          )}
        </div>
      </div>

      <div className="home-cols" style={{ marginTop: 0 }}>
        <div className="panel panel-p">
          <div className="section-title" style={{ marginBottom: 10 }}>
            Recent box scores
          </div>
          {recentStats.length === 0 ? (
            <div className="empty">No games yet — advance a league week.</div>
          ) : (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Wk</th>
                  {cols.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentStats.map((s) => (
                  <tr key={s.weekNumber}>
                    <td>{s.weekNumber}</td>
                    {cols.map((c) => (
                      <td key={c.key}>{(s as unknown as Record<string, number>)[c.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel panel-p">
          <div className="section-title" style={{ marginBottom: 10 }}>
            Card scarcity
          </div>
          <div className="parallel-grid">
            {parallels.map((p) => {
              const def = PARALLEL_MAP[p.parallel];
              const pct = p.printRun ? (p.allocated / p.printRun) * 100 : 0;
              return (
                <div className="par-box" key={p.parallel}>
                  <div className="between">
                    <span className="mono" style={{ color: p.parallel === 'BLACK' ? '#cfd6e2' : def.color, fontWeight: 700, fontSize: 12 }}>
                      {def.displayName}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {p.remaining} of {p.printRun} left
                  </div>
                  <div className="par-bar">
                    <span style={{ width: `${pct}%`, background: p.parallel === 'BLACK' ? '#cfd6e2' : def.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
