import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EyeOff, Play } from 'lucide-react';
import { IntroScene } from './components/intro/IntroScene';
import { LoginTransition } from './components/intro/LoginTransition';
import { RoleSelection } from './components/auth/RoleSelection';
import { AdministrationLogin } from './components/auth/AdministrationLogin';
import { HODLogin } from './components/auth/HODLogin';
import { AdministrationWorkspace } from './components/portal/AdministrationWorkspace';
import { HODWorkspace } from './components/portal/HODWorkspace';
import {
  AuthenticationService,
  getStoredSessionToken,
} from './services/AuthenticationService';
import type {
  AuthUser,
  DepartmentCode,
  SandboxCredentialHint,
  UserRole,
} from './types/auth';

const SKIP_PREF_KEY = 'smartattend_skip_intro';
const REDUCED_MOTION_KEY = 'smartattend_reduced_motion';

type AppView = 'intro' | 'login' | 'portal';

export default function App() {
  const [rememberSkip, setRememberSkip] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SKIP_PREF_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(REDUCED_MOTION_KEY);
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  const [view, setView] = useState<AppView>(() => (rememberSkip ? 'login' : 'intro'));
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sandboxAccounts, setSandboxAccounts] = useState<SandboxCredentialHint[]>([]);
  const [showSandbox, setShowSandbox] = useState(false);
  const [adminPrefill, setAdminPrefill] = useState<{
    identifier: string;
    password: string;
    nonce: number;
  } | null>(null);
  const [hodPrefill, setHodPrefill] = useState<{
    department: DepartmentCode;
    identifier: string;
    password: string;
    nonce: number;
  } | null>(null);

  const refreshSandboxAccounts = async () => {
    try {
      const sandbox = await AuthenticationService.getSandboxAccounts();
      if (sandbox.enabled) {
        setSandboxAccounts(sandbox.accounts);
      }
    } catch {
      // Ignore sandbox fetch failure
    }
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const [session, sandbox] = await Promise.all([
          AuthenticationService.getSession(),
          AuthenticationService.getSandboxAccounts().catch(() => ({
            enabled: false,
            accounts: [] as SandboxCredentialHint[],
          })),
        ]);
        if (!active) return;
        if (sandbox.enabled) {
          setSandboxAccounts(sandbox.accounts);
        }
        if (session.authenticated && session.user) {
          setAuthUser(session.user);
          setView('portal');
        }
      } catch {
        // Proceed with login flow
      } finally {
        if (active) setSessionChecked(true);
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleRememberSkip = (remember: boolean) => {
    setRememberSkip(remember);
    try {
      window.localStorage.setItem(SKIP_PREF_KEY, String(remember));
    } catch {
      // Ignore storage errors
    }
  };

  const handleToggleReducedMotion = () => {
    setReducedMotion((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(REDUCED_MOTION_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleAuthenticated = (user: AuthUser) => {
    setAuthUser(user);
    setSelectedRole(null);
    setAdminPrefill(null);
    setHodPrefill(null);
    setView('portal');
  };

  const handleLogout = async () => {
    await AuthenticationService.logout().catch(() => undefined);
    setAuthUser(null);
    setSelectedRole(null);
    setView('login');
  };

  const handleUseSandboxAccount = (acc: SandboxCredentialHint) => {
    setShowSandbox(false);
    if (acc.role === 'ADMINISTRATION') {
      setHodPrefill(null);
      setAdminPrefill({
        identifier: acc.loginId,
        password: acc.temporaryPassphrase,
        nonce: Date.now(),
      });
      setSelectedRole('ADMINISTRATION');
    } else if (acc.department) {
      setAdminPrefill(null);
      setHodPrefill({
        department: acc.department,
        identifier: acc.loginId,
        password: acc.temporaryPassphrase,
        nonce: Date.now(),
      });
      setSelectedRole('HOD');
    }
  };

  if (view === 'portal' && authUser) {
    return authUser.role === 'ADMINISTRATION' ? (
      <AdministrationWorkspace user={authUser} onLogout={handleLogout} />
    ) : (
      <HODWorkspace user={authUser} onLogout={handleLogout} />
    );
  }

  if (!sessionChecked && (rememberSkip || Boolean(getStoredSessionToken()))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#172B2A] text-sm text-[#ECFDF5]/80">
        Verifying institutional session...
      </div>
    );
  }

  if (view === 'intro') {
    return (
      <IntroScene
        reducedMotion={reducedMotion}
        rememberSkip={rememberSkip}
        onToggleReducedMotion={handleToggleReducedMotion}
        onToggleRememberSkip={handleToggleRememberSkip}
        onComplete={() => {
          setView('login');
          void refreshSandboxAccounts();
        }}
      />
    );
  }

  return (
    <LoginTransition reducedMotion={reducedMotion}>
      <div className="teaching-board-surface relative flex min-h-screen w-full flex-col justify-between p-3 text-[#ECFDF5] sm:p-5">
        <div className="flex flex-1 flex-col justify-between rounded-sm border border-[#10B981]/30 px-6 py-8 sm:px-12 sm:py-10">
          <header className="mx-auto flex w-full max-w-2xl flex-col items-center pt-4 text-center sm:pt-8">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[0.06em] text-[#FFFFFF] sm:text-4xl">
              SMARTATTEND
            </h1>
            <p className="mt-2.5 text-sm font-medium tracking-wide text-[#34D399]">
              Smart Attendance. Zero Smartphones.
            </p>
            <div className="mt-6 h-px w-24 bg-[#10B981]/45" aria-hidden="true" />
          </header>

          <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center py-10">
            <div className="w-full">
              <AnimatePresence mode="wait">
                {selectedRole === null && (
                  <motion.div
                    key="board-role-selection"
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{
                      duration: reducedMotion ? 0.1 : 0.25,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <RoleSelection
                      onSelectRole={(role) => {
                        setAdminPrefill(null);
                        setHodPrefill(null);
                        setSelectedRole(role);
                      }}
                    />
                  </motion.div>
                )}

                {selectedRole === 'ADMINISTRATION' && (
                  <motion.div
                    key={`board-admin-login-${adminPrefill?.nonce ?? 0}`}
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{
                      duration: reducedMotion ? 0.1 : 0.25,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <AdministrationLogin
                      prefill={adminPrefill}
                      onBack={() => {
                        setAdminPrefill(null);
                        setSelectedRole(null);
                      }}
                      onAuthenticated={handleAuthenticated}
                    />
                  </motion.div>
                )}

                {selectedRole === 'HOD' && (
                  <motion.div
                    key={`board-hod-login-${hodPrefill?.nonce ?? 0}`}
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{
                      duration: reducedMotion ? 0.1 : 0.25,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <HODLogin
                      prefill={hodPrefill}
                      onBack={() => {
                        setHodPrefill(null);
                        setSelectedRole(null);
                      }}
                      onAuthenticated={handleAuthenticated}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

          <footer className="space-y-3 border-t border-[#10B981]/25 pt-4">
            {showSandbox && sandboxAccounts.length > 0 && (
              <div className="mx-auto max-w-2xl overflow-x-auto rounded-lg border border-[#ECFDF5]/15 bg-[#10201F] px-4 py-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#ECFDF5]/10 text-[#ECFDF5]/60">
                      <th className="py-1 pr-3 font-medium">Role</th>
                      <th className="py-1 pr-3 font-medium">Dept</th>
                      <th className="py-1 pr-3 font-medium">ID</th>
                      <th className="py-1 pr-3 font-medium">Password</th>
                      <th className="py-1 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECFDF5]/8 font-mono tabular-nums">
                    {sandboxAccounts.map((acc) => (
                      <tr key={acc.loginId}>
                        <td className="py-1.5 pr-3 font-sans text-[#ECFDF5]/85">{acc.role}</td>
                        <td className="py-1.5 pr-3 text-[#34D399]">{acc.department ?? 'ALL'}</td>
                        <td className="py-1.5 pr-3 text-[#FFFFFF]">{acc.loginId}</td>
                        <td className="py-1.5 pr-3 text-[#ECFDF5]/90">{acc.temporaryPassphrase}</td>
                        <td className="py-1.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleUseSandboxAccount(acc)}
                            className="rounded border border-[#10B981]/60 px-2.5 py-0.5 text-[11px] font-semibold text-[#34D399] transition-colors hover:bg-[#10B981] hover:text-[#06281E]"
                          >
                            Use
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#ECFDF5]/70">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                    setView('intro');
                  }}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-[#34D399]"
                >
                  <Play className="h-3 w-3 text-[#34D399]" aria-hidden="true" />
                  <span>Replay Intro</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleReducedMotion}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-[#34D399]"
                >
                  <EyeOff className="h-3 w-3 text-[#34D399]" aria-hidden="true" />
                  <span>{reducedMotion ? 'Reduced Motion: On' : 'Reduced Motion: Off'}</span>
                </button>

                {sandboxAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showSandbox;
                      setShowSandbox(next);
                      if (next) void refreshSandboxAccounts();
                    }}
                    className="transition-colors hover:text-[#34D399]"
                  >
                    {showSandbox ? 'Hide Test Accounts' : 'Test Accounts'}
                  </button>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2 hover:text-[#FFFFFF]">
                <input
                  type="checkbox"
                  checked={rememberSkip}
                  onChange={(e) => handleToggleRememberSkip(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#ECFDF5]/35 bg-[#172B2A] accent-[#10B981]"
                />
                <span>Skip intro on next visit</span>
              </label>
            </div>
          </footer>
        </div>
      </div>
    </LoginTransition>
  );
}
