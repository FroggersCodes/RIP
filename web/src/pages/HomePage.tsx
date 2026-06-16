import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, API_BASE } from '../api/client';
import { useApi } from '../lib/useApi';
import { RipReveal, type RevealCard } from '../components/RipReveal';
import { countdown, num } from '../lib/format';
import type { DailyStatus, DailyClaimResult } from '../api/types';

interface LeagueCurrent {
  current: { season: number; weekNumber: number } | null;
  lastSimulated: { season: number; weekNumber: number; simulatedAt: string } | null;
}

export function HomePage() {
  const { user, setUser } = useAuth();
  const daily = useApi(() => api<DailyStatus>('/daily/status'), []);
  const league = useApi(() => api<LeagueCurrent>('/league/current'), []);
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
  const [adminToken, setAdminToken] = useState('dev-admin');
  const [advancing, setAdvancing] = useState(false);
  const [advanceMsg, setAdvanceMsg] = useState<string | null>(null);
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

  const advance = async () => {
    setAdvancing(true);
    setAdvanceMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/advance-week`, { method: 'POST', headers: { 'x-admin-token': adminToken } });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setAdvanceMsg(`Simulated week ${d.weekNumber}: ${d.statsRecorded} box-score lines, ${d.playersRevalued} players revalued.`);
      league.reload();
    } catch (e) {
      setAdvanceMsg(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setAdvancing(false);
    }
  };

  const ds = daily.data;
  return (
    <>
      {reveal && <RipReveal cards={reveal} title={revealTitle} onClose={() => setReveal(null)} />}
      <div className="page-head">
        <h1>Welcome back, {user?.username}</h1>
        <p>Claim your daily, rip a pack, and build a lineup that wins the week.</p>
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
            <div className="label">Dust</div>
            <div className="kpi">{num(user?.dust ?? 0)}</div>
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
          <hr className="divider" style={{ margin: '14px 0' }} />
          <div className="section-title">Dev · advance week</div>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input mono" style={{ maxWidth: 160 }} value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
            <button className="btn" onClick={advance} disabled={advancing}>
              {advancing ? 'Simulating…' : 'Advance week'}
            </button>
          </div>
          {advanceMsg && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{advanceMsg}</div>}
        </div>
        <div className="panel panel-p">
          <div className="section-title">How it works</div>
          <ul className="muted" style={{ lineHeight: 1.8, marginTop: 8, paddingLeft: 18 }}>
            <li>Numbered cards are finite — one owner per serial, forever.</li>
            <li>Each simulated week moves player values from real box scores.</li>
            <li>Your equipped lineup scores from those same stats.</li>
            <li>Recycle base cards into dust, then spend dust on packs.</li>
          </ul>
          <Link to="/leaderboard" className="btn btn-ghost" style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            View leaderboard →
          </Link>
        </div>
      </div>
    </>
  );
}
