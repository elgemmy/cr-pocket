import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MotionConfig } from 'motion/react';
import { AppLayout } from '@/app/AppLayout';
import { SignInScreen } from '@/app/SignInScreen';
import UiKitPage from '@/app/UiKitPage';
import { ToastViewport } from '@/ui/Toast';
import LibraryPage from '@/features/library/LibraryPage';
import EditorPage from '@/features/editor/EditorPage';
import PlayerPage from '@/features/player/PlayerPage';
import ImportPage from '@/features/import/ImportPage';
import SettingsPage from '@/features/settings/SettingsPage';
import { appMode } from '@/config';

/**
 * TODO(integrator): wire auth gating from src/data here —
 *   const { status, user, signIn } = useAuth();
 *   if (status === 'loading') return <FullScreenLoader/>;
 *   if (status === 'signed-out') return <SignInScreen onSignIn={signIn} demoMode={appMode === 'demo'} …/>;
 *   then render <AppLayout syncState={syncState} user={user}/> with the routes below.
 * Until then the shell renders directly (demo).
 */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          {/* Dev previews (not linked in the tab bar) */}
          <Route path="/sign-in" element={<SignInScreen onSignIn={() => {}} demoMode={appMode === 'demo'} />} />
          <Route element={<AppLayout syncState={appMode === 'demo' ? 'demo' : 'synced'} />}>
            <Route index element={<LibraryPage />} />
            <Route path="/deck/new" element={<EditorPage />} />
            <Route path="/deck/:id" element={<EditorPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/player/:tag" element={<PlayerPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/ui-kit" element={<UiKitPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </MotionConfig>
  );
}
