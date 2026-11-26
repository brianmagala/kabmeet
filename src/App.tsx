import { AppShell } from './components/AppShell';
import { KabmeetProvider, useKabmeet } from './context/KabmeetContext';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { ClassesPage } from './pages/ClassesPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { HostPanelPage } from './pages/HostPanelPage';
import { ProfilePage } from './pages/ProfilePage';
import { RoomPage } from './pages/RoomPage';
import { WatchPage } from './pages/WatchPage';

function KabmeetRouter() {
  const { route } = useKabmeet();

  switch (route) {
    case 'discover':
      return <DiscoverPage />;
    case 'communities':
      return <CommunitiesPage />;
    case 'watch':
      return <WatchPage />;
    case 'room':
      return <RoomPage />;
    case 'classes':
      return <ClassesPage />;
    case 'host-panel':
      return <HostPanelPage />;
    case 'leaderboard':
      return <LeaderboardPage />;
    case 'profile':
      return <ProfilePage />;
    case 'admin':
      return <AdminPage />;
    case 'auth':
      return <AuthPage />;
    default:
      return <DiscoverPage />;
  }
}

export default function App() {
  return (
    <KabmeetProvider>
      <AppShell>
        <KabmeetRouter />
      </AppShell>
    </KabmeetProvider>
  );
}
