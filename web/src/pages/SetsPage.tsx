import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { num } from '../lib/format';
import type { SetsResponse, SetChecklistTeam, User } from '../api/types';

export function SetsPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const { data, loading, reload } = useApi(() => api<SetsResponse>('/cards/sets'), []);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sets = data?.sets ?? [];

  const claim = async (setKey: string, team: SetChecklistTeam) => {
    const id = `${setKey}|${team.abbreviation}`;
    setBusy(id);
    setError(null);
    try {
      const r = await api<{ gemsAwarded: number; user: User }>(
        `/cards/sets/${setKey}/teams/${team.abbreviation}/claim`,
        { method: 'POST' },
      );
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
          Complete a team's base checklist within a set to claim a small{' '}
          <span className="gem-text">💎 gem</span> reward. Finishing a whole set is a long grind —
          gems are how you afford the Reliquary.
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
            return (
              <div key={s.setKey} className="panel panel-p set-panel">
                <div className="set-head">
                  <div>
                    <div className="set-wordmark">{s.label}</div>
                    <div className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>
                      base set · {num(s.gemsPerTeam)} 💎 per team · {s.teamsClaimed}/{s.teamsTotal} teams claimed
                    </div>
                  </div>
                  <div className="set-reward">
                    <div className="gem-text mono set-reward-amt">+{num(s.gemsPerTeam)} 💎</div>
                    <span className="muted" style={{ fontSize: 12 }}>per team</span>
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

                <div className="set-teams">
                  {s.teams.map((t) => {
                    const id = `${s.setKey}|${t.abbreviation}`;
                    const expanded = open === id;
                    const tpct = t.total > 0 ? (t.owned / t.total) * 100 : 0;
                    return (
                      <div key={t.abbreviation} className={`set-team ${t.complete ? 'complete' : ''} ${t.claimed ? 'claimed' : ''}`}>
                        <button className="set-team-head" onClick={() => setOpen(expanded ? null : id)}>
                          <span className="set-team-abbr">{t.abbreviation}</span>
                          <span className="muted mono" style={{ fontSize: 11 }}>
                            {t.owned}/{t.total}
                          </span>
                        </button>
                        <span className="set-team-bar">
                          <span style={{ width: `${Math.max(3, tpct)}%` }} />
                        </span>
                        <div className="set-team-foot">
                          {t.claimed ? (
                            <span className="mission-done">✓ claimed</span>
                          ) : t.claimable ? (
                            <button className="btn btn-sm btn-gold" disabled={busy === id} onClick={() => claim(s.setKey, t)}>
                              {busy === id ? '…' : `Claim ${num(t.gems)} 💎`}
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: 11 }}>{t.total - t.owned} to go</span>
                          )}
                        </div>
                        {expanded && (
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
