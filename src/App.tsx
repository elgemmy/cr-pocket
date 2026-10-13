import { createBrowserRouter, Navigate, Route, RouterProvider, Routes } from 'react-router';
import { MotionConfig } from 'motion/react';
import { AppLayout } from '@/app/AppLayout';
import { SignInScreen } from '@/app/SignInScreen';
import UiKitPage from '@/app/UiKitPage';
import { useSyncPillState } from '@/app/session';
import { ToastViewport } from '@/ui/Toast';
import LibraryPage from '@/features/library/LibraryPage';
import EditorPage from '@/features/editor/EditorPage';
import PlayerPage from '@/features/player/PlayerPage';
import ImportPage from '@/features/import/ImportPage';
import SettingsPage from '@/features/settings/SettingsPage';
import { useAuth } from '@/data/auth';
import { HeroScene } from '@/scene3d';
import { PwaToasts } from '@/app/pwa';

function SignedInApp() {
  const user = useAuth((s) => s.user);
  const syncState = useSyncPillState();
  return (
    <Routes>
      <Route element={<AppLayout syncState={syncState} user={user ? { name: user.displayName, photoURL: user.photoURL } : null} />}>
        <Route index element={<LibraryPage />} />
        <Route path="/deck/new" element={<EditorPage />} />
        <Route path="/deck/:id" element={<EditorPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/player/:tag" element={<PlayerPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {import.meta.env.DEV && <Route path="/ui-kit" element={<UiKitPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AuthGate() {
  const status = useAuth((s) => s.status);
  const mode = useAuth((s) => s.mode);
  const error = useAuth((s) => s.error);
  const signIn = useAuth((s) => s.signInWithGoogle);

  if (status === 'signedIn') return <SignedInApp />;
  // While auth restores, show the sign-in layout with a busy button instead of a blocking splash.
  return (
    <SignInScreen
      onSignIn={() => void signIn()}
      loading={status === 'loading'}
      error={error}
      demoMode={mode === 'demo'}
      hero={<HeroScene variant="signin" />}
    />
  );
}

function Root() {
  return (
    <>
      <AuthGate />
      <ToastViewport />
      <PwaToasts />
    </>
  );
}

// A data router is required for useBlocker (editor unsaved-changes guard); routes stay declarative in SignedInApp.
const router = createBrowserRouter([{ path: '*', element: <Root /> }]);

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
