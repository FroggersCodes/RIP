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
  Mission,
  RewardsStatus,
  User,
} from '../api/types';

interface LeagueCurrent {
  current: { season: number; weekNumber: number } | null;
  lastSimulated: { season: number; weekNumber: number; simulatedAt: string } | null;
}

export function HomePage() {
  const { user, setUser } = useAuth();
  const daily = useApi(() => api<DailyStatus>('/daily/status'), []);
  const rewards = useApi(() => api<RewardsStatus>('/rewards'), []);
  const league = useApi(() => api<LeagueCurrent>('/league/current'), []);
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

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

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
      const bits = [`+${num(r.reward.coins)} coins`, r.reward.cases && `+${r.reward.cases} case`].filter(Boolean);
      setToast(`Day ${r.streak} · ${bits.join(' · ')}`);
      rewards.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setClaimingReward(false);
    }
  };

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
                  {rs.daily.reward.cases > 0 && <span className="tag">+{rs.daily.reward.cases} case</span>}
                </div>
                <button className="btn btn-gold btn-lg" onClick={claimDailyReward} disabled={claimingReward}>
                  {claimingReward ? 'Claiming…' : 'Claim daily reward'}
                </button>
                <div className="muted" style={{ fontSize: 12 }}>
                  Keep the streak alive — tomorrow pays {num(rs.daily.nextReward.coins)} coins
                  {rs.daily.nextReward.cases > 0 ? ' + a case' : ''}.
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
                  Come back tomorrow for day {rs.daily.streak + 1} · {num(rs.daily.nextReward.coins)} coins
                  {rs.daily.nextReward.cases > 0 ? ' + a case' : ''}.
                </div>
              </>
            )
          ) : (
            <div className="spin" />
          )}
        </div>
      </div>

      <div className="quick-grid">
        <Link to="/rip" className="quick-tile">
          <div className="section-title">Open</div>
          <div className="qt-title">Rip packs</div>
          <div className="qt-sub">Chase finite serials</div>
        </Link>
        <Link to="/battle" className="quick-tile">
          <div className="section-title">Compete</div>
          <div className="qt-title">Head to head</div>
          <div className="qt-sub">Beat the house</div>
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
          <div className="section-title">League status</div>
          <div className="between" style={{ marginTop: 10 }}>
            <div>
              <div className="muted">Current week</div>
              <div className="kpi" style={{ fontSize: 26 }}>
                {league.data?.current ? `Week ${league.data.current.weekNumber}` : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted">Last simulated</div>
              <div className="kpi" style={{ fontSize: 26 }}>
                {league.data?.lastSimulated ? `Week ${league.data.lastSimulated.weekNumber}` : '—'}
              </div>
            </div>
          </div>
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
