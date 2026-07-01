import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { RipReveal, type RevealCard } from '../components/RipReveal';
import { division } from '@rip/shared';
import { countdown, num } from '../lib/format';
import type {
  ClockInfo,
  DailyStatus,
  DailyClaimResult,
  DailyRewardResult,
  FeedEvent,
  HourlyClaimResult,
  LeagueMe,
  Mission,
  RewardsStatus,
  User,
} from '../api/types';

export function HomePage() {
  const { user, setUser } = useAuth();
  const daily = useApi(() => api<DailyStatus>('/daily/status'), []);
  const rewards = useApi(() => api<RewardsStatus>('/rewards'), []);
  const leagueMe = useApi(() => api<LeagueMe>('/league/me'), []);
  const clock = useApi(() => api<ClockInfo>('/league/clock'), []);
  const missions = useApi(() => api<{ missions: Mission[] }>('/missions'), []);
  const feed = useApi(() => api<{ events: FeedEvent[] }>('/feed'), []);

  const claimMission = async (key: string) => {
    try {
      const r = await api<{ user: User }>(`/missions/${key}/claim`, { method: 'POST' });
      setUser(r.user);
      missions.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };
  const rewardText = (m: Mission) =>
    [m.rewardTokens && `${m.rewardTokens} tokens`, m.rewardCases && `${m.rewardCases} case`]
      .filter(Boolean)
      .join(' + ');
  const gotw = useApi(
    () =>
      api<{
        week: { weekNumber: number } | null;
        games: { home: string; away: string; homeScore: number; awayScore: number; isFeatured: boolean; recap: string | null }[];
      }>('/league/scoreboard'),
    [],
  );
  const [reveal, setReveal] = useState<RevealCard[] | null>(null);
  const [revealTitle, setRevealTitle] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimingHourly, setClaimingHourly] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0);
  // Weekly recap: pop a one-time summary of your finish the first time you see a
  // newly-simulated week. A per-season+week marker in localStorage gates it.
  const [recap, setRecap] = useState<LeagueMe['lastWeek']>(null);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const weekMarker = (season: number, week: number) => season * 100 + week;
  useEffect(() => {
    const lm = leagueMe.data;
    if (!lm?.lastWeek) return;
    const seen = Number(localStorage.getItem('rip.seenLeagueWeek') ?? 0);
    if (weekMarker(lm.season, lm.lastWeek.weekNumber) > seen) setRecap(lm.lastWeek);
  }, [leagueMe.data]);

  const dismissRecap = () => {
    const lm = leagueMe.data;
    if (lm?.lastWeek) localStorage.setItem('rip.seenLeagueWeek', String(weekMarker(lm.season, lm.lastWeek.weekNumber)));
    setRecap(null);
  };

  const claim = async () => {
    setClaiming(true);
    try {
      const r = await api<DailyClaimResult>('/daily/claim', { method: 'POST' });
      setUser(r.user);
      setRevealTitle(`Daily claimed · ${r.tier.name} · streak ${r.streak}`);
      setReveal(r.cards as RevealCard[]);
      daily.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setClaiming(false);
    }
  };


  const claimHourly = async () => {
    setClaimingHourly(true);
    try {
      const r = await api<HourlyClaimResult>('/rewards/hourly/claim', { method: 'POST' });
      setUser(r.user);
      setToast(`+${num(r.coins)} coins`);
      rewards.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setClaimingHourly(false);
    }
  };

  const claimDailyReward = async () => {
    setClaimingReward(true);
    try {
      const r = await api<DailyRewardResult>('/rewards/daily/claim', { method: 'POST' });
      setUser(r.user);
      const bits = [
        `+${num(r.reward.coins)} coins`,
        r.reward.gems > 0 && `+${r.reward.gems} 💎`,
        r.reward.packLabel && `${r.reward.packLabel} pack`,
      ].filter(Boolean);
      setToast(`Day ${r.streak} · ${bits.join(' · ')}`);
      // A pack day rolls real cards — show the reveal like the daily pack does.
      if (r.cards.length) {
        setRevealTitle(`Daily reward · day ${r.streak}${r.reward.packLabel ? ` · ${r.reward.packLabel}` : ''}`);
        setReveal(r.cards as RevealCard[]);
      }
      rewards.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setClaimingReward(false);
    }
  };

  // A short "Coins · +5 💎 · Artistry pack" line describing a login-reward day.
  const rewardSummary = (rw: { coins: number; gems: number; packLabel: string | null }) =>
    [`${num(rw.coins)} coins`, rw.gems > 0 && `${rw.gems} 💎`, rw.packLabel && `${rw.packLabel} pack`]
      .filter(Boolean)
      .join(' · ');

  // Auto-dismiss the little reward toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const ds = daily.data;
  const rs = rewards.data;
  return (
    <>
      {reveal && <RipReveal cards={reveal} title={revealTitle} onClose={() => setReveal(null)} />}
      {toast && <div className="reward-toast">{toast}</div>}
      {recap && (
        <div className="modal-overlay" onClick={dismissRecap}>
          <div className="modal panel recap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">Week {recap.weekNumber} results are in</div>
            <div className={`recap-rank ${recap.rank <= 3 ? 'podium' : ''}`}>
              {recap.rank === 1 ? '🥇' : recap.rank === 2 ? '🥈' : recap.rank === 3 ? '🥉' : '#' + recap.rank}
            </div>
            <div className="recap-line">
              You finished <b>#{recap.rank}</b> of {recap.totalPlayers} with{' '}
              <b className="mono">{recap.points.toFixed(1)}</b> lineup pts.
            </div>
            <div className="recap-prize">🏆 Prize banked: <b>{recap.payoutLabel}</b></div>
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <Link to="/standings" className="btn btn-ghost" onClick={dismissRecap}>
                See standings
              </Link>
              <button className="btn btn-gold" onClick={dismissRecap}>
                {recap.rank <= 3 ? 'Defend my spot' : 'Set my lineup'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="page-head between">
        <div>
          <h1>Welcome back, {user?.username}</h1>
          <p>Claim your daily, rip a pack, and build a lineup that wins the week.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: 12 }}>Rank</div>
          <div className="kpi gold" style={{ fontSize: 22 }}>{division(user?.rating ?? 1000)}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>{num(user?.rating ?? 1000)} rating</div>
        </div>
      </div>

      {leagueMe.data && (() => {
        const lm = leagueMe.data;
        return (
          <div className="panel panel-p league-spot">
            <div className="between league-spot-head">
              <div className="section-title">
                Your league week{lm.currentWeek ? ` · Week ${lm.currentWeek.weekNumber}` : ''}
              </div>
              <span className="tag division-tag">{lm.division} · {num(lm.rating)}</span>
            </div>
            <div className="league-spot-grid">
              <div className="ls-cell">
                <div className="ls-label">Last week</div>
                {lm.lastWeek ? (
                  <>
                    <div className="ls-rank">
                      #{lm.lastWeek.rank}
                      <span className="ls-of"> of {lm.lastWeek.totalPlayers}</span>
                    </div>
                    <div className="ls-sub">{lm.lastWeek.points.toFixed(1)} lineup pts</div>
                    <div className="ls-prize">🏆 won {lm.lastWeek.payoutLabel}</div>
                  </>
                ) : (
                  <div className="ls-empty">No lineup last week — you left prizes on the table.</div>
                )}
              </div>
              <div className="ls-cell ls-live">
                <div className="ls-label">This week · live projection</div>
                {lm.currentWeek ? (
                  <>
                    <div className="ls-rank">
                      #{lm.currentWeek.projectedRank}
                      <span className="ls-of"> of {Math.max(lm.currentWeek.totalPlayers, 1)}</span>
                    </div>
                    <div className="ls-sub">
                      {lm.currentWeek.projectedPoints.toFixed(1)} projected pts · {lm.currentWeek.filledSlots}/{lm.currentWeek.totalSlots} slots set
                    </div>
                    {clock.data &&
                      (clock.data.locked ? (
                        <div className="ls-lock">🔒 Locked — kickoff imminent</div>
                      ) : (
                        <div className="ls-sub">
                          Lock in <span className="mono" style={{ color: 'var(--text)' }}>{countdown(clock.data.nextAdvanceAt)}</span>
                        </div>
                      ))}
                  </>
                ) : (
                  <div className="ls-empty">Season starting soon.</div>
                )}
                <Link to="/lineup" className="btn btn-gold" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                  {lm.currentWeek && lm.currentWeek.filledSlots < lm.currentWeek.totalSlots ? 'Finish your lineup →' : 'Manage lineup →'}
                </Link>
              </div>
            </div>
            <div className="ls-ladder muted">
              Win the week and bank <b style={{ color: 'var(--gold)' }}>1,000🪙 · 3 cases · 3💎</b>. Top 3 all earn gems — the league is the fastest way to premium currency.
            </div>
          </div>
        );
      })()}

      <div className="home-hero">
        <div className="hero-bals">
          <div className="hero-bal">
            <div className="label">Tokens</div>
            <div className="kpi gold">{num(user?.tokens ?? 0)}</div>
          </div>
          <div className="hero-bal">
            <div className="label">Cases</div>
            <div className="kpi">{num(user?.cases ?? 0)}</div>
          </div>
          <div className="hero-bal">
            <div className="label">Gems</div>
            <div className="kpi gem-text">{num(user?.gems ?? 0)}</div>
          </div>
        </div>
        <div className="daily-card">
          <div className="between">
            <div className="section-title">Daily Pack</div>
            {ds && <span className="tag">streak {ds.streak}</span>}
          </div>
          {ds ? (
            ds.canClaim ? (
              <>
                <div className="muted">
                  Your free <b style={{ color: 'var(--text)' }}>{ds.currentTier.name}</b> is ready — {ds.currentTier.cards}{' '}
                  cards + {ds.currentTier.tokenReward} tokens.
                </div>
                <button className="btn btn-gold btn-lg" onClick={claim} disabled={claiming}>
                  {claiming ? 'Opening…' : 'Claim daily pack'}
                </button>
              </>
            ) : (
              <>
                <div className="muted">
                  Next claim in <span className="mono" style={{ color: 'var(--text)' }}>{countdown(ds.nextClaimAt)}</span>
                </div>
                <button className="btn" disabled>
                  Claimed today
                </button>
              </>
            )
          ) : (
            <div className="spin" />
          )}
          {ds?.nextTier && (
            <div className="muted" style={{ fontSize: 13 }}>
              Reach a {ds.nextTier.atStreak}-day streak to unlock {ds.nextTier.name}.
            </div>
          )}
        </div>
      </div>

      <div className="rewards-grid">
        <div className="panel panel-p reward-card">
          <div className="between">
            <div className="section-title">Hourly Coins</div>
            <span className="tag">{rs ? `${rs.hourly.ratePerHour}/hr` : '—'}</span>
          </div>
          {rs ? (
            <>
              <div className="reward-amt">
                <span className="coin-ic">🪙</span>
                <span className="kpi gold">{num(rs.hourly.coins)}</span>
                <span className="muted" style={{ fontSize: 13 }}>ready</span>
              </div>
              {rs.hourly.canClaim ? (
                <button className="btn btn-gold btn-lg" onClick={claimHourly} disabled={claimingHourly}>
                  {claimingHourly ? 'Claiming…' : `Collect ${num(rs.hourly.coins)} coins`}
                </button>
              ) : (
                <button className="btn" disabled>
                  Next coin in {countdown(rs.hourly.nextClaimAt)}
                </button>
              )}
              <div className="muted" style={{ fontSize: 12 }}>
                {rs.hourly.maxedOut ? (
                  <b style={{ color: 'var(--gold)' }}>Bank full — collect before it caps out.</b>
                ) : (
                  <>Earns {rs.hourly.ratePerHour} coins/hour, banking up to {num(rs.hourly.maxCoins)} ({rs.hourly.capHours}h).</>
                )}
              </div>
            </>
          ) : (
            <div className="spin" />
          )}
        </div>

        <div className="panel panel-p reward-card">
          <div className="between">
            <div className="section-title">Daily Reward</div>
            {rs && <span className="tag">🔥 {rs.daily.streak}-day streak</span>}
          </div>
          {rs ? (
            rs.daily.canClaim ? (
              <>
                <div className="reward-amt">
                  <span className="coin-ic">🪙</span>
                  <span className="kpi gold">{num(rs.daily.reward.coins)}</span>
                  {rs.daily.reward.gems > 0 && <span className="tag gem-tag">+{rs.daily.reward.gems} 💎</span>}
                  {rs.daily.reward.packLabel && <span className="tag">🎁 {rs.daily.reward.packLabel} pack</span>}
                </div>
                <button className="btn btn-gold btn-lg" onClick={claimDailyReward} disabled={claimingReward}>
                  {claimingReward ? 'Claiming…' : 'Claim daily reward'}
                </button>
                <div className="muted" style={{ fontSize: 12 }}>
                  Keep the streak alive — tomorrow: {rewardSummary(rs.daily.nextReward)}.
                </div>
              </>
            ) : (
              <>
                <div className="reward-amt">
                  <span className="muted">Next reward in </span>
                  <span className="mono" style={{ color: 'var(--text)' }}>{countdown(rs.daily.nextClaimAt)}</span>
                </div>
                <button className="btn" disabled>
                  Claimed today
                </button>
                <div className="muted" style={{ fontSize: 12 }}>
                  Day {rs.daily.streak + 1} tomorrow: {rewardSummary(rs.daily.nextReward)}.
                </div>
              </>
            )
          ) : (
            <div className="spin" />
          )}
        </div>
      </div>

      {rs && rs.daily.schedule.length > 0 && (
        <div className="panel panel-p reward-schedule">
          <div className="between">
            <div className="section-title">Upcoming daily rewards</div>
            <span className="muted" style={{ fontSize: 12 }}>🔥 keep your streak going</span>
          </div>
          <div className="sched-strip">
            {rs.daily.schedule.map((d, i) => (
              <div className={`sched-day${i === 0 ? ' next' : ''}`} key={d.day}>
                <div className="sched-daynum">Day {d.day}</div>
                <div className="sched-coins">
                  <span className="coin-ic">🪙</span> {num(d.coins)}
                </div>
                <div className="sched-badges">
                  {d.gems > 0 && <span className="tag gem-tag">{d.gems} 💎</span>}
                  {d.packLabel && <span className="tag">🎁 {d.packLabel}</span>}
                </div>
                {i === 0 && <div className="sched-flag">{rs.daily.canClaim ? 'Today' : 'Next'}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quick-grid">
        <Link to="/rip" className="quick-tile">
          <div className="section-title">Open</div>
          <div className="qt-title">Rip packs</div>
          <div className="qt-sub">Chase finite serials</div>
        </Link>
        <Link to="/standings" className="quick-tile">
          <div className="section-title">Compete</div>
          <div className="qt-title">League standings</div>
          <div className="qt-sub">Win the week</div>
        </Link>
        <Link to="/lineup" className="quick-tile">
          <div className="section-title">Build</div>
          <div className="qt-title">Your lineup</div>
          <div className="qt-sub">Score the week</div>
        </Link>
        <Link to="/teams" className="quick-tile">
          <div className="section-title">Explore</div>
          <div className="qt-title">16 teams</div>
          <div className="qt-sub">Values & trends</div>
        </Link>
      </div>

      {(() => {
        const f = gotw.data?.games.find((g) => g.isFeatured);
        if (!f) return null;
        return (
          <div className="panel panel-p gotw">
            <div className="section-title">Game of the Week{gotw.data?.week ? ` · week ${gotw.data.week.weekNumber}` : ''}</div>
            <div className="gotw-score">
              <span className="gotw-team">{f.home}</span>
              <span className="gotw-num mono">{f.homeScore}</span>
              <span className="muted">–</span>
              <span className="gotw-num mono">{f.awayScore}</span>
              <span className="gotw-team">{f.away}</span>
            </div>
            {f.recap && <div className="muted" style={{ marginTop: 6 }}>{f.recap}</div>}
          </div>
        );
      })()}

      {missions.data && (
        <div className="panel panel-p" style={{ marginTop: 16 }}>
          <div className="section-title">Missions · earn tokens &amp; cases</div>
          <div style={{ marginTop: 8 }}>
            {missions.data.missions.map((m) => (
              <div className="mission-row" key={m.key}>
                <div className="grow">
                  <div className="mission-label">
                    {m.label} {m.period === 'ONCE' && <span className="tag">one-time</span>}
                  </div>
                  <div className="mission-bar">
                    <span style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }} />
                  </div>
                  <div className="muted mono" style={{ fontSize: 11, marginTop: 3 }}>
                    {m.progress}/{m.target} · {rewardText(m)}
                  </div>
                </div>
                {m.claimed ? (
                  <span className="mission-done">✓ claimed</span>
                ) : m.claimable ? (
                  <button className="btn btn-sm btn-gold" onClick={() => claimMission(m.key)}>
                    Claim
                  </button>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>in progress</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="home-cols">
        <div className="panel panel-p">
          <div className="section-title">Season race</div>
          {leagueMe.data?.seasonStanding ? (
            <div className="between" style={{ marginTop: 10 }}>
              <div>
                <div className="muted">Your season rank</div>
                <div className="kpi gold" style={{ fontSize: 26 }}>
                  #{leagueMe.data.seasonStanding.rank}
                  <span className="muted" style={{ fontSize: 14 }}> of {leagueMe.data.seasonStanding.totalPlayers}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted">Season pts</div>
                <div className="kpi" style={{ fontSize: 26 }}>{leagueMe.data.seasonStanding.points.toFixed(1)}</div>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 10 }}>Field a lineup and score a week to join the season race.</div>
          )}
          {clock.data && (
            <div style={{ marginTop: 10 }}>
              {clock.data.locked ? (
                <span className="lock-tag">🔒 Lineups locked — kickoff imminent</span>
              ) : (
                <span className="muted">
                  Next kickoff in{' '}
                  <span className="mono" style={{ color: 'var(--text)' }}>{countdown(clock.data.nextAdvanceAt)}</span>
                  {' · '}auto-sim {clock.data.autoAdvance ? 'on' : 'off'}
                </span>
              )}
            </div>
          )}
          <Link to="/standings" className="btn btn-ghost" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            View standings →
          </Link>
        </div>
        <div className="panel panel-p">
          <div className="section-title">Around the league</div>
          <div style={{ marginTop: 8 }}>
            {feed.data?.events.length ? (
              feed.data.events.slice(0, 12).map((e) => (
                <div className="feed-row" key={e.id}>
                  <span className="feed-ic">
                    {e.type === 'PULL' ? '✦' : e.type === 'SALE' ? '$' : e.type === 'CHAMPION' ? '🏆' : '★'}
                  </span>
                  <span className="feed-text">{e.text}</span>
                </div>
              ))
            ) : (
              <div className="muted">No activity yet — rip a pack or make a sale to get the feed going.</div>
            )}
          </div>
          <Link to="/leaderboard" className="btn btn-ghost" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            View leaderboard →
          </Link>
        </div>
      </div>
    </>
  );
}
