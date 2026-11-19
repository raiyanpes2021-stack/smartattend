import { useState, type ReactNode } from 'react';
import {
  Cloud,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AuthUser } from '../../types/auth';
import type { FirebaseConnectionStatus } from '../../firebase';

export interface PortalNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

interface PortalShellProps {
  user: AuthUser;
  portalSubtitle: string;
  navItems: PortalNavItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  firebaseStatus: FirebaseConnectionStatus;
  firebaseUserEmail: string | null;
  children: ReactNode;
}

export function PortalShell({
  user,
  portalSubtitle,
  navItems,
  activeTab,
  onSelectTab,
  onLogout,
  onRefresh,
  refreshing,
  firebaseStatus,
  firebaseUserEmail,
  children,
}: PortalShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#172B2A] text-[#ECFDF5]">
      <div>
        <div className="border-b border-[#10B981]/20 px-5 py-5">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.06em] text-[#FFFFFF]">
              SMARTATTEND
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded p-1 text-[#ECFDF5]/65 hover:text-[#34D399] lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-[11px] font-medium text-[#34D399]">
            Smart Attendance. Zero Smartphones.
          </p>
          <div className="mt-3 rounded-lg border border-[#ECFDF5]/12 bg-[#10201F] px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-[#34D399]">
              {user.role === 'ADMINISTRATION' ? (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{portalSubtitle}</span>
            </div>
            <p className="mt-0.5 truncate text-[#ECFDF5]/75">
              {user.fullName} · {user.loginId}
            </p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4" aria-label="Portal Navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#10B981] font-semibold text-[#06281E]'
                    : 'text-[#ECFDF5]/85 hover:bg-[#1E3836] hover:text-[#FFFFFF]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className={active ? 'text-[#06281E]' : 'text-[#34D399]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                      active
                        ? 'bg-[#06281E] text-[#34D399]'
                        : 'border border-[#10B981]/50 text-[#34D399]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-[#ECFDF5]/12 p-4">
        <div
          className="rounded-lg border border-[#ECFDF5]/12 bg-[#10201F] px-3 py-2 text-[11px]"
          title={firebaseStatus.diagnosticMessage}
        >
          <div className="flex items-center gap-1.5 text-[#34D399]">
            <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-medium">
              {firebaseStatus.checking
                ? 'Checking Firestore...'
                : firebaseStatus.reachable
                  ? 'Firestore Connected'
                  : 'Firestore Offline'}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[#ECFDF5]/65">
            {firebaseUserEmail ? `Synced: ${firebaseUserEmail}` : 'Cloud Sync: Ready to link'}
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#ECFDF5]/20 px-3 py-2 text-xs font-medium text-[#ECFDF5] transition-colors hover:border-[#34D399] hover:text-[#34D399]"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const currentNav = navItems.find((i) => i.id === activeTab);

  return (
    <div className="flex min-h-screen bg-[#F0FDF4] text-[#0F1F1E]">
      <aside className="hidden w-64 shrink-0 border-r border-[#10B981]/20 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0C1918]/75 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-[#10B981]/25">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#D1E7DC] bg-[#FFFFFF]/95 px-4 py-3.5 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D1E7DC] bg-white text-[#172B2A] hover:border-[#10B981] hover:text-[#059669] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-base font-semibold text-[#172B2A] sm:text-lg">
                {currentNav?.label ?? 'Dashboard'}
              </h1>
              <p className="text-[11px] text-slate-600">
                {user.role === 'ADMINISTRATION'
                  ? 'Institution-wide Governance Portal'
                  : `Department-Locked Workspace · ${user.department}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1E7DC] bg-white px-3 py-1.5 text-xs font-medium text-[#172B2A] transition-colors hover:border-[#10B981] hover:text-[#059669] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#10B981]' : 'text-[#059669]'}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
