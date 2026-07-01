import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { Card } from '../components/Card';
import { money, countdown } from '../lib/format';
import type { ClockInfo, Collection, Lineup, LeagueMe, LeaderboardEntry, LineupSlotView } from '../api/types';

export function LineupPage() {
  const { user } = useAuth();
  const lineup = useApi(() => api<Lineup>('/lineup'), []);
  const collection = useApi(() => api<Collection>('/cards'), []);
  const lb = useApi(() => api<{ week: { weekNumber: number } | null; entries: LeaderboardEntry[] }>('/league/leaderboard'), []);
  const leagueMe = useApi(() => api<LeagueMe>('/league/me'), []);
  const clock = useApi(() => api<ClockInfo>('/league/clock'), []);
  const locked = clock.data?.locked ?? false;
  const [picking, setPicking] = useState<LineupSlotView | null>(null);
  const [busy, setBusy] = useState(false);

  const equip = async (role: string, cardInstanceId: string) => {
    setBusy(true);
    try {
      const r = await api<Lineup>(`/lineup/${role}`, { method: 'PUT', body: { cardInstanceId } });
      lineup.setData(r);
      setPicking(null);
      collection.reload();
      leagueMe.reload();
    } finally {
      setBusy(false);
    }
  };

  const unequip = async (role: string) => {
    const r = await api<Lineup>(`/lineup/${role}`, { method: 'DELETE' });
    lineup.setData(r);
    collection.reload();
    leagueMe.reload();
  };

  const myScore = lb.data?.entries.find((e) => e.username === user?.username);
  const eligible = picking
    ? (collection.data?.cards ?? []).filter((c) => picking.eligiblePositions.includes(c.player.position) && !c.listed)
    : [];

  return (
    <>
      <div className="page-head between">
        <div>
          <h1>Your lineup</h1>
          <p>Equip eligible cards by role. Each simulated week it scores from your players' real box scores.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted">Lineup value</div>
          <div className="kpi gold" style={{ fontSize: 28 }}>
            {money(lineup.data?.totalValue ?? 0)}
          </div>
          {lb.data?.week && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Week {lb.data.week.weekNumber} score:{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                {myScore ? myScore.points.toFixed(1) : '—'}
              </span>
            </div>
          )}
        </div>
      </div>

      {leagueMe.data && (() => {
        const lm = leagueMe.data;
        return (
          <div className="lineup-stakes">
            <div className="ls-stat ls-live">
              <span className="ls-label">This week · projected</span>
              {lm.currentWeek ? (
                <>
                  <span className="ls-stat-v">
                    #{lm.currentWeek.projectedRank}
                    <span className="ls-of"> of {Math.max(lm.currentWeek.totalPlayers, 1)}</span>
                  </span>
                  <span className="ls-sub">
                    {lm.currentWeek.projectedPoints.toFixed(1)} proj pts · {lm.currentWeek.filledSlots}/{lm.currentWeek.totalSlots} slots
                  </span>
                </>
              ) : (
                <span className="ls-sub">Season starting soon</span>
              )}
            </div>
            <div className="ls-stat">
              <span className="ls-label">Last week</span>
              {lm.lastWeek ? (
                <>
                  <span className="ls-stat-v">
                    #{lm.lastWeek.rank}
                    <span className="ls-of"> of {lm.lastWeek.totalPlayers}</span>
                  </span>
                  <span className="ls-sub">{lm.lastWeek.points.toFixed(1)} pts · won {lm.lastWeek.payoutLabel}</span>
                </>
              ) : (
                <span className="ls-sub">No lineup scored — don't miss this week.</span>
              )}
            </div>
            <div className="ls-stat">
              <span className="ls-label">Win the week</span>
              <span className="ls-stat-v gold-num">1,000🪙</span>
              <span className="ls-sub">+3 cases +3💎 · top 3 all earn gems</span>
            </div>
          </div>
        );
      })()}

      {locked && (
        <div className="lock-banner">
          🔒 Lineups are locked — kickoff is imminent{clock.data ? ` (next slate ${countdown(clock.data.nextAdvanceAt)})` : ''}. Changes reopen after the next sim.
        </div>
      )}

      {lineup.loading ? (
        <div className="center" style={{ padding: 60 }}>
          <div className="spin" />
        </div>
      ) : (
        <div className="lineup-grid">
          {lineup.data?.slots.map((slot) => (
            <div className="slot" key={slot.role}>
              <div className="between" style={{ width: '100%' }}>
                <span className="slot-role">{slot.role}</span>
                <span className="slot-elig">{slot.eligiblePositions.join(' / ')}</span>
              </div>
              {slot.card ? (
                <>
                  <Card card={slot.card} size="sm" />
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-sm" disabled={locked} onClick={() => setPicking(slot)}>
                      Change
                    </button>
                    <button className="btn btn-sm btn-ghost" disabled={locked} onClick={() => unequip(slot.role)}>
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div className="slot-empty" onClick={locked ? undefined : () => setPicking(slot)}>
                  {locked ? '🔒 Locked' : '+ Equip'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {picking && (
        <div className="modal-overlay" onClick={() => setPicking(null)}>
          <div className="modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="between" style={{ marginBottom: 14 }}>
              <h2>
                Pick a card for {picking.role}{' '}
                <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
                  ({picking.eligiblePositions.join(' / ')})
                </span>
              </h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setPicking(null)}>
                Close
              </button>
            </div>
            {eligible.length === 0 ? (
              <div className="empty">No eligible cards. Rip more packs or check the right position.</div>
            ) : (
              <div className="cards-grid">
                {eligible.map((c) => (
                  <Card key={c.id} card={c} size="sm" onClick={() => !busy && equip(picking.role, c.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
