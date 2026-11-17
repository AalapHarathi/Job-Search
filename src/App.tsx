import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { firebaseConfigured } from '@/lib/config';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { UIProvider } from '@/context/UIContext';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui';
import { SetupRequired } from '@/pages/SetupRequired';
import { Login } from '@/pages/Login';
import { Overview } from '@/pages/Overview';
import { Discover } from '@/pages/Discover';
import { Search } from '@/pages/Search';
import { Recommended } from '@/pages/Recommended';
import { Saved } from '@/pages/Saved';
import { Applied } from '@/pages/Applied';
import { Pipeline } from '@/pages/Pipeline';
import { Rejected } from '@/pages/Rejected';
import { Resume } from '@/pages/Resume';
import { Analytics } from '@/pages/Analytics';
import { Preferences } from '@/pages/Preferences';
import { Settings } from '@/pages/Settings';
import { Notifications } from '@/pages/Notifications';

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-full flex items-center justify-center"><Spinner className="size-6" /></div>;
  if (!user) return <Login />;
  return (
    <DataProvider>
      <UIProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="search" element={<Search />} />
            <Route path="discover" element={<Discover />} />
            <Route path="recommended" element={<Recommended />} />
            <Route path="saved" element={<Saved />} />
            <Route path="applied" element={<Applied />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="rejected" element={<Rejected />} />
            <Route path="resume" element={<Resume />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="settings" element={<Settings />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </UIProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {firebaseConfigured ? (
        <AuthProvider>
          {/* Hash routing: GitHub Pages has no server-side rewrites. */}
          <HashRouter><Gate /></HashRouter>
        </AuthProvider>
      ) : <SetupRequired />}
    </ThemeProvider>
  );
}
