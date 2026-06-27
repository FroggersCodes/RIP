import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import type { SetsResponse, SetProgress, User } from '../api/types';

export function SetsPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const { data, loading, reload } = useApi(() => api<SetsResponse>('/cards/sets'), []);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sets = data?.sets ?? [];

  const claim = async (s: SetProgress) => {
    setBusy(s.setKey);
    setError(null);
    try {
      const r = await api<{ gemsAwarded: number; user: User }>(`/cards/sets/${s.setKey}/claim`, { method: 'POST' });
      setUser(r.user);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Sets</h1>
        <p>
          Track your base checklist for every set. Own the base card of all{' '}
          {sets[0] ? num(sets[0].total) : ''} players in a set to complete it and claim{' '}
          <span className="gem-text">💎 gems</span> — the only way to earn the Reliquary's currency.
        </p>
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div className="center" style={{ padding: 60 }}>
          <div className="spin" />
        </div>
      ) : sets.length === 0 ? (
        <div className="empty">No trackable sets yet.</div>
      ) : (
        <div className="sets-list">
          {sets.map((s) => {
            const pct = s.total > 0 ? (s.owned / s.total) * 100 : 0;
            const expanded = open === s.setKey;
            return (
              <div key={s.setKey} className={`panel panel-p set-panel ${s.complete ? 'complete' : ''}`}>
                <div className="set-head">
                  <div>
                    <div className="set-wordmark">{s.label}</div>
                    <div className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>
                      base set · tier {s.tierLevel}
                    </div>
                  </div>
                  <div className="set-reward">
                    <div className="gem-text mono set-reward-amt">{num(s.gems)} 💎</div>
                    {s.claimed ? (
                      <span className="mission-done">✓ claimed</span>
                    ) : s.claimable ? (
                      <button className="btn btn-gold" disabled={busy === s.setKey} onClick={() => claim(s)}>
                        {busy === s.setKey ? 'Claiming…' : 'Claim reward'}
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {num(s.total - s.owned)} to go
                      </span>
                    )}
                  </div>
                </div>

                <div className="set-progress-row">
                  <span className="set-progress-bar">
                    <span style={{ width: `${Math.max(2, pct)}%` }} />
                  </span>
                  <span className="mono set-progress-label">
                    {num(s.owned)} / {num(s.total)}
                  </span>
                </div>

                <button className="btn btn-sm btn-ghost" style={{ marginTop: 4 }} onClick={() => setOpen(expanded ? null : s.setKey)}>
                  {expanded ? 'Hide checklist' : 'Show checklist'}
                </button>

                {expanded && (
                  <div className="set-teams">
                    {s.teams.map((t) => (
                      <div key={t.abbreviation} className="set-team">
                        <div className="set-team-head">
                          <span className="set-team-abbr">{t.abbreviation}</span>
                          <span className="muted mono" style={{ fontSize: 11 }}>
                            {t.owned}/{t.total}
                          </span>
                        </div>
                        <div className="set-team-players">
                          {t.players.map((p) => (
                            <button
                              key={p.id}
                              className={`set-chip ${p.owned ? 'owned' : 'missing'}`}
                              onClick={() => nav(`/players/${p.id}`)}
                              title={`${p.name} · ${p.position}`}
                            >
                              <span className="set-chip-mark">{p.owned ? '✓' : '○'}</span>
                              <span className="set-chip-name">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
