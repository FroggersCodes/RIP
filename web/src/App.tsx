import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { RipPage } from './pages/RipPage';
import { LineupPage } from './pages/LineupPage';
import { CollectionPage } from './pages/CollectionPage';
import { SetsPage } from './pages/SetsPage';
import { MarketPage } from './pages/MarketPage';
import { TeamsPage } from './pages/TeamsPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { PlayerDetailPage } from './pages/PlayerDetailPage';
import { StandingsPage } from './pages/StandingsPage';
import { StatsPage } from './pages/StatsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminPage } from './pages/AdminPage';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="center" style={{ height: '100vh' }}>
        <div className="spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/rip" element={<RipPage />} />
        <Route path="/lineup" element={<LineupPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/sets" element={<SetsPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route path="/players/:id" element={<PlayerDetailPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
