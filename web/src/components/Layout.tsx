import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { num } from '../lib/format';

type Item = { to: string; label: string };
type Group = { label: string; items: Item[] };

// Grouped navigation: 11 flat links collapse into Home + three menus so the
// top bar stays scannable. Detail routes (e.g. /teams/:id) light up their group.
const GROUPS: Group[] = [
  {
    label: 'Play',
    items: [
      { to: '/rip', label: 'Rip' },
      { to: '/lineup', label: 'Lineup' },
    ],
  },
  {
    label: 'Collect',
    items: [
      { to: '/collection', label: 'Collection' },
      { to: '/sets', label: 'Sets' },
      { to: '/market', label: 'Market' },
    ],
  },
  {
    label: 'League',
    items: [
      { to: '/teams', label: 'Teams' },
      { to: '/standings', label: 'Standings' },
      { to: '/stats', label: 'Stats' },
      { to: '/leaderboard', label: 'Leaderboard' },
    ],
  },
];

function NavGroup({ group, open, onToggle, onNavigate }: { group: Group; open: boolean; onToggle: () => void; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const active = group.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  return (
    <div className="nav-group">
      <button type="button" className={`nav-link nav-trigger ${active ? 'active' : ''}`} onClick={onToggle} aria-expanded={open}>
        {group.label}
        <span className={`caret ${open ? 'up' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="nav-menu">
          {group.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              onClick={onNavigate}
              className={({ isActive }) => `nav-menu-item ${isActive ? 'active' : ''}`}
            >
              {i.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close any open menu on outside click.
  useEffect(() => {
    if (!openGroup) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openGroup]);

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="brand" onClick={() => setOpenGroup(null)}>
            RIP<span className="dot">.</span>
          </NavLink>
          <nav className="nav-links" ref={navRef}>
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpenGroup(null)}>
              Home
            </NavLink>
            {GROUPS.map((g) => (
              <NavGroup
                key={g.label}
                group={g}
                open={openGroup === g.label}
                onToggle={() => setOpenGroup((cur) => (cur === g.label ? null : g.label))}
                onNavigate={() => setOpenGroup(null)}
              />
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
              <Link to="/admin" className="admin-link" title="Dev tools">
                ⚙
              </Link>
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
