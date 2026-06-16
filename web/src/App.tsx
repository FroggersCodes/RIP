import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { RipPage } from './pages/RipPage';
import { BattlePage } from './pages/BattlePage';
import { LineupPage } from './pages/LineupPage';
import { CollectionPage } from './pages/CollectionPage';
import { TeamsPage } from './pages/TeamsPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { PlayerDetailPage } from './pages/PlayerDetailPage';
import { StandingsPage } from './pages/StandingsPage';
import { StatsPage } from './pages/StatsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';

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
        <Route path="/battle" element={<BattlePage />} />
        <Route path="/lineup" element={<LineupPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route path="/players/:id" element={<PlayerDetailPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
