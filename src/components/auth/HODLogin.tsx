import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AuthenticationService, AuthApiError } from '../../services/AuthenticationService';
import { DEPARTMENTS, type AuthUser, type DepartmentCode } from '../../types/auth';
import { PasswordResetModal } from './PasswordResetModal';

interface HODLoginProps {
  onBack: () => void;
  onAuthenticated: (user: AuthUser) => void;
  prefill?: {
    department: DepartmentCode;
    identifier: string;
    password: string;
  } | null;
}

export function HODLogin({ onBack, onAuthenticated, prefill }: HODLoginProps) {
  const [department, setDepartment] = useState<DepartmentCode>(
    prefill?.department ?? 'CSE',
  );
  const [hodId, setHodId] = useState(prefill?.identifier ?? '');
  const [password, setPassword] = useState(prefill?.password ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hodId.trim() || !password) {
      setError('Enter your assigned HOD ID and password.');
      return;
    }

    setLoading(true);
    try {
      const session = await AuthenticationService.login({
        role: 'HOD',
        department,
        identifier: hodId.trim(),
        password,
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
          HOD Login
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
          <label className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/85">
            Department
          </label>
          <div
            className="grid grid-cols-4 gap-2"
            role="radiogroup"
            aria-label="Department"
          >
            {DEPARTMENTS.map((dept) => {
              const active = department === dept.code;
              return (
                <button
                  key={dept.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setDepartment(dept.code);
                    setError(null);
                  }}
                  className={`min-h-[42px] rounded-lg border text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981] ${
                    active
                      ? 'border-[#10B981] bg-[#10B981] text-[#06281E]'
                      : 'border-[#ECFDF5]/22 bg-[#10201F] text-[#ECFDF5]/85 hover:border-[#10B981]/70'
                  }`}
                >
                  {dept.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="hod-id"
            className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/85"
          >
            HOD ID
          </label>
          <input
            id="hod-id"
            type="text"
            autoComplete="username"
            required
            value={hodId}
            onChange={(e) => setHodId(e.target.value)}
            placeholder={`HOD-${department}-01`}
            className="w-full rounded-lg border border-[#ECFDF5]/22 bg-[#10201F] px-4 py-3 font-mono text-sm text-[#FFFFFF] placeholder:font-sans placeholder:text-[#ECFDF5]/35 focus:border-[#10B981] focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="hod-password"
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
              id="hod-password"
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
          role="HOD"
          initialIdentifier={hodId}
          initialDepartment={department}
          onClose={() => setShowReset(false)}
          onResetSuccess={(updatedId) => {
            setHodId(updatedId);
            setPassword('');
            setShowReset(false);
          }}
        />
      )}
    </div>
  );
}
