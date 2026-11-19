import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AuthenticationService, AuthApiError } from '../../services/AuthenticationService';
import type { AuthUser } from '../../types/auth';
import { PasswordResetModal } from './PasswordResetModal';

interface AdministrationLoginProps {
  onBack: () => void;
  onAuthenticated: (user: AuthUser) => void;
  prefill?: { identifier: string; password: string } | null;
}

export function AdministrationLogin({
  onBack,
  onAuthenticated,
  prefill,
}: AdministrationLoginProps) {
  const [identifier, setIdentifier] = useState(prefill?.identifier ?? '');
  const [password, setPassword] = useState(prefill?.password ?? '');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Enter your Administration ID or email and password.');
      return;
    }

    setLoading(true);
    try {
      const session = await AuthenticationService.login({
        role: 'ADMINISTRATION',
        identifier: identifier.trim(),
        password,
        rememberMe,
      });
      if (session.authenticated && session.user) {
        onAuthenticated(session.user);
      }
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : 'Unable to authenticate with the server.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <div className="flex items-center justify-between border-b border-[#ECFDF5]/15 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[34px] items-center gap-1.5 text-xs font-medium text-[#ECFDF5]/75 transition-colors hover:text-[#34D399]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back</span>
        </button>
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#34D399]">
          Administration Login
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-400/45 bg-amber-500/12 px-3.5 py-2.5 text-xs text-[#FFFFFF]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="admin-identifier"
            className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/85"
          >
            Administration ID / Email
          </label>
          <input
            id="admin-identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="ADMIN-001 or admin@smartattend.edu"
            className="w-full rounded-lg border border-[#ECFDF5]/22 bg-[#10201F] px-4 py-3 text-sm text-[#FFFFFF] placeholder:text-[#ECFDF5]/35 focus:border-[#10B981] focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-[#ECFDF5]/85"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-xs text-[#34D399] transition-colors hover:text-[#FFFFFF]"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-[#ECFDF5]/22 bg-[#10201F] py-3 pl-4 pr-12 text-sm text-[#FFFFFF] placeholder:text-[#ECFDF5]/35 focus:border-[#10B981] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#ECFDF5]/65 transition-colors hover:text-[#34D399]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#ECFDF5]/75 hover:text-[#FFFFFF]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[#ECFDF5]/35 bg-[#10201F] accent-[#10B981]"
          />
          <span>Remember Me</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex min-h-[46px] w-full items-center justify-center rounded-lg bg-[#10B981] px-5 py-3 text-sm font-semibold text-[#06281E] transition-colors hover:bg-[#34D399] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFFFF] disabled:opacity-60"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      {showReset && (
        <PasswordResetModal
          role="ADMINISTRATION"
          initialIdentifier={identifier}
          onClose={() => setShowReset(false)}
          onResetSuccess={(updatedId) => {
            setIdentifier(updatedId);
            setPassword('');
            setShowReset(false);
          }}
        />
      )}
    </div>
  );
}
