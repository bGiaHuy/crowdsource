import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from './stores/useAppStore';
import { supabase } from './services/supabase';

// Layout
import Layout from './components/layout/Layout';

// Pages
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import PortalPage from './pages/PortalPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AdminPage from './pages/AdminPage';

// Dev-only tool: lazy-loaded to exclude from production bundle
const DeltaMapAnnotationTool = lazy(() => import('./tools/DeltaMapAnnotationTool'));

function App() {
  const { user, setUser } = useAppStore();

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin" element={<AdminPage />} />
        
        <Route path="/" element={user ? <Layout /> : <Navigate to="/auth" />}>
          <Route index element={<HomePage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="portal" element={<PortalPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {import.meta.env.DEV && (
            <Route
              path="tools/delta-map-annotation"
              element={
                <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--color-text-light)' }}>Loading tool...</div>}>
                  <DeltaMapAnnotationTool />
                </Suspense>
              }
            />
          )}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
