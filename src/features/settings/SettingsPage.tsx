import { useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/data/auth';
import { Avatar, Badge, Button, ConfirmDialog, Disclaimer } from '@/ui';
import { CategoriesCard } from './CategoriesCard';
import { DataCard } from './DataCard';
import { PlayerTagCard } from './PlayerTagCard';

/** App version — bump with package.json releases. */
const APP_VERSION = '0.1.0';

/** Account summary: avatar, identity, and an honest mode badge. */
function AccountCard() {
  const user = useAuth((s) => s.user);
  const mode = useAuth((s) => s.mode);
  if (!user) return null;

  return (
    <section className="surface flex items-center gap-3.5 p-4 sm:p-5" aria-label="Account">
      <Avatar name={user.displayName} photoURL={user.photoURL} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg text-ink">{user.displayName ?? 'Player'}</p>
        {user.email && <p className="truncate text-sm text-ink-dim">{user.email}</p>}
        <div className="mt-1.5">
          {mode === 'demo' ? (
            <Badge tone="violet">Demo — this device only</Badge>
          ) : (
            <Badge tone="good">Signed in with Google</Badge>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * F1/F7 — Settings: account, player tag, categories, data & sync, sign out, about.
 */
export default function SettingsPage() {
  const signOut = useAuth((s) => s.signOut);
  const mode = useAuth((s) => s.mode);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-display text-2xl text-ink">Settings</h1>
        <Settings className="size-5 text-ink-faint" aria-hidden />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <AccountCard />
        <PlayerTagCard />
        <CategoriesCard />
        <DataCard />

        {/* Sign out */}
        <section className="surface p-4 sm:p-5">
          <Button
            variant="danger"
            icon={<LogOut />}
            fullWidth
            onClick={() => setConfirmSignOut(true)}
          >
            Sign out
          </Button>
        </section>

        {/* About */}
        <footer className="px-2 pb-2 text-center">
          <p className="text-xs font-bold text-ink-faint">CR Pocket v{APP_VERSION}</p>
          <p className="mt-0.5 text-xs text-ink-faint">More decks. Less deck management.</p>
          <Disclaimer className="mt-3" />
        </footer>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setSigningOut(true);
          void signOut().finally(() => {
            setSigningOut(false);
            setConfirmSignOut(false);
          });
        }}
        title="Sign out of CR Pocket?"
        body={
          mode === 'demo'
            ? 'Demo decks stay in this browser — sign back in any time to keep playing.'
            : 'Your decks stay safe in the cloud. The offline copy cached on this device is wiped when you sign out.'
        }
        confirmLabel="Sign out"
        tone="danger"
        loading={signingOut}
      />
    </div>
  );
}
