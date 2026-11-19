import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { AuthenticationService, AuthApiError } from '../../services/AuthenticationService';
import { DEPARTMENTS, type DepartmentCode, type UserRole } from '../../types/auth';

interface PasswordResetModalProps {
  role: UserRole;
  initialIdentifier?: string;
  initialDepartment?: DepartmentCode;
  onClose: () => void;
  onResetSuccess: (identifier: string) => void;
}

export function PasswordResetModal({
  role,
  initialIdentifier = '',
  initialDepartment = 'CSE',
  onClose,
  onResetSuccess,
}: PasswordResetModalProps) {
  const [step, setStep] = useState<'request' | 'verify' | 'done'>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [department, setDepartment] = useState<DepartmentCode>(initialDepartment);
  const [resetId, setResetId] = useState('');
  const [maskedDestination, setMaskedDestination] = useState('');
  const [verificationHint, setVerificationHint] = useState<string | undefined>(undefined);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await AuthenticationService.initiatePasswordReset({
        role,
        identifier,
        department: role === 'HOD' ? department : undefined,
      });
      setResetId(res.resetId);
      setMaskedDestination(res.maskedDestination);
      setVerificationHint(res.verificationHint);
      setStep('verify');
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : 'Unable to initiate password reset.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await AuthenticationService.completePasswordReset({
        resetId,
        code,
        newPassword,
      });
      setStep('done');
    } catch (err) {
      setError(
        err instanceof AuthApiError
          ? err.message
          : 'Unable to complete password reset.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C1918]/85 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#10B981]/35 bg-[#172B2A] p-6 text-[#ECFDF5] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECFDF5]/12 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#10B981]/45 bg-[#10B981]/12 text-[#34D399]">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="reset-modal-title"
                className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#FFFFFF]"
              >
                Reset {role === 'ADMINISTRATION' ? 'Administration' : 'HOD'} Password
              </h2>
              <p className="text-xs text-[#ECFDF5]/65">
                Backend-verified institutional credential recovery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close password reset dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#ECFDF5]/14 text-[#ECFDF5]/70 transition-colors hover:border-[#10B981]/60 hover:text-[#FFFFFF]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-400/45 bg-amber-500/12 px-3.5 py-2.5 text-xs text-[#FFFFFF]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="mt-5 space-y-4">
            {role === 'HOD' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/80">
                  Assigned Department
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept.code}
                      type="button"
                      onClick={() => setDepartment(dept.code)}
                      className={`min-h-[40px] rounded-lg border text-xs font-semibold transition-colors ${
                        department === dept.code
                          ? 'border-[#10B981] bg-[#10B981] text-[#06281E]'
                          : 'border-[#ECFDF5]/18 bg-[#10201F] text-[#ECFDF5]/80 hover:border-[#10B981]/60'
                      }`}
                    >
                      {dept.code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="reset-identifier"
                className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/80"
              >
                {role === 'ADMINISTRATION' ? 'Administration ID or Email' : 'HOD ID or Email'}
              </label>
              <input
                id="reset-identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={role === 'ADMINISTRATION' ? 'ADMIN-001' : `HOD-${department}-01`}
                className="w-full rounded-lg border border-[#ECFDF5]/20 bg-[#10201F] px-3.5 py-2.5 text-sm text-[#FFFFFF] placeholder:text-[#ECFDF5]/35 focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] rounded-lg border border-[#ECFDF5]/18 px-4 py-2 text-xs font-medium text-[#ECFDF5]/80 hover:border-[#ECFDF5]/35 hover:text-[#FFFFFF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[40px] rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#34D399] disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </div>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyAndReset} className="mt-5 space-y-4">
            <div className="rounded-lg border border-[#ECFDF5]/14 bg-[#10201F] px-3.5 py-3 text-xs text-[#ECFDF5]/80">
              <p>
                A 6-digit verification code was issued for{' '}
                <span className="font-mono text-[#FFFFFF]">{maskedDestination}</span>.
              </p>
              {verificationHint && (
                <p className="mt-1.5 font-mono text-[#34D399]">
                  Sandbox verification code: <span className="font-semibold">{verificationHint}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reset-code"
                className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/80"
              >
                Verification Code
              </label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                className="w-full rounded-lg border border-[#ECFDF5]/20 bg-[#10201F] px-3.5 py-2.5 font-mono text-sm tracking-widest text-[#FFFFFF] placeholder:text-[#ECFDF5]/35 focus:border-[#10B981] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reset-new-password"
                className="mb-1.5 block text-xs font-medium text-[#ECFDF5]/80"
              >
                New Password (min 8 chars, letters & numbers)
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  className="w-full rounded-lg border border-[#ECFDF5]/20 bg-[#10201F] py-2.5 pl-3.5 pr-10 text-sm text-[#FFFFFF] placeholder:text-[#ECFDF5]/35 focus:border-[#10B981] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#ECFDF5]/60 hover:text-[#34D399]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="min-h-[40px] rounded-lg border border-[#ECFDF5]/18 px-4 py-2 text-xs font-medium text-[#ECFDF5]/80 hover:border-[#ECFDF5]/35"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[40px] rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#34D399] disabled:opacity-60"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-[#10B981]/45 bg-[#10B981]/12 p-4 text-sm text-[#ECFDF5]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#34D399]" aria-hidden="true" />
              <div>
                <p className="font-medium">Password updated successfully</p>
                <p className="mt-1 text-xs text-[#ECFDF5]/75">
                  Your updated credentials are stored securely. Use them to sign in now.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onResetSuccess(identifier)}
                className="min-h-[40px] rounded-lg bg-[#10B981] px-5 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#34D399]"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
