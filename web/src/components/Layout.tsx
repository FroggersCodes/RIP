import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { num } from '../lib/format';

const LINKS: [string, string][] = [
  ['/', 'Home'],
  ['/rip', 'Rip'],
  ['/battle', 'Battle'],
  ['/lineup', 'Lineup'],
  ['/collection', 'Collection'],
  ['/sets', 'Sets'],
  ['/market', 'Market'],
  ['/teams', 'Teams'],
  ['/standings', 'Standings'],
  ['/stats', 'Stats'],
  ['/leaderboard', 'Leaderboard'],
];

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="brand">
            RIP<span className="dot">.</span>
          </NavLink>
          <nav className="nav-links">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="grow" />
          {user && (
            <div className="balances">
              <span className="bal" title="Tokens">
                <span className="ic" style={{ background: 'var(--gold)' }} />
                {num(user.tokens)}
              </span>
              <span className="bal" title="Cases">
                <span className="ic" style={{ background: 'var(--blue)' }} />
                {num(user.cases)}
              </span>
              <span className="bal" title="Gems">
                <span className="ic gem-ic" style={{ background: 'var(--gem)' }} />
                {num(user.gems)}
              </span>
              <button className="btn btn-sm btn-ghost" onClick={logout}>
                {user.username} · Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
