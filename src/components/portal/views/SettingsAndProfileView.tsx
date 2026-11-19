import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  Cloud,
  Database,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  linkGoogleFirebaseAuth,
  unlinkGoogleFirebaseAuth,
  type FirebaseConnectionStatus,
} from '../../../firebase';
import { FirebaseSyncService } from '../../../services/FirebaseSyncService';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { WorkspaceBootstrapData } from '../../../types/smartattend';

interface SettingsAndProfileViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  firebaseStatus: FirebaseConnectionStatus;
  firebaseUserEmail: string | null;
  onFirebaseAuthChanged: (email: string | null) => void;
  onRecheckFirebase: () => Promise<void>;
  onDataChanged: () => Promise<void>;
}

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
];

export function SettingsAndProfileView({
  data,
  isAdmin,
  firebaseStatus,
  firebaseUserEmail,
  onFirebaseAuthChanged,
  onRecheckFirebase,
  onDataChanged,
}: SettingsAndProfileViewProps) {
  // Admin Institution Settings state
  const [institutionName, setInstitutionName] = useState(data.settings.institutionName);
  const [institutionCode, setInstitutionCode] = useState(data.settings.institutionCode);
  const [institutionTimezone, setInstitutionTimezone] = useState(
    data.settings.institutionTimezone || 'Asia/Kolkata',
  );
  const [lowThreshold, setLowThreshold] = useState(data.settings.lowAttendanceThreshold);
  const [highConf, setHighConf] = useState(data.settings.highConfidenceThreshold);
  const [pendingConf, setPendingConf] = useState(data.settings.pendingConfidenceThreshold);
  const [retentionDays, setRetentionDays] = useState(data.settings.biometricRetentionDays);
  const [allowManualFallback, setAllowManualFallback] = useState(
    data.settings.allowManualFallback,
  );
  const [totalPeriodsPerDay, setTotalPeriodsPerDay] = useState(
    data.settings.totalPeriodsPerDay || 7,
  );
  const [checkpointPeriods, setCheckpointPeriods] = useState<number[]>(
    data.settings.fullDayCheckpointPeriods ?? [1, 4, 7],
  );

  // Profile / Password state
  const [fullName, setFullName] = useState(data.user.fullName);
  const [phone, setPhone] = useState(data.user.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setInstitutionName(data.settings.institutionName);
    setInstitutionCode(data.settings.institutionCode);
    setInstitutionTimezone(data.settings.institutionTimezone || 'Asia/Kolkata');
    setLowThreshold(data.settings.lowAttendanceThreshold);
    setHighConf(data.settings.highConfidenceThreshold);
    setPendingConf(data.settings.pendingConfidenceThreshold);
    setRetentionDays(data.settings.biometricRetentionDays);
    setAllowManualFallback(data.settings.allowManualFallback);
    setTotalPeriodsPerDay(data.settings.totalPeriodsPerDay || 7);
    setCheckpointPeriods(data.settings.fullDayCheckpointPeriods ?? [1, 4, 7]);
  }, [data.settings]);

  useEffect(() => {
    setFullName(data.user.fullName);
    setPhone(data.user.phone ?? '');
  }, [data.user]);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleCheckpointPeriod = (periodNum: number) => {
    setCheckpointPeriods((prev) =>
      prev.includes(periodNum)
        ? prev.filter((p) => p !== periodNum)
        : [...prev, periodNum].sort((a, b) => a - b),
    );
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await SmartAttendService.updateSettings({
        institutionName,
        institutionCode,
        institutionTimezone,
        lowAttendanceThreshold: lowThreshold,
        highConfidenceThreshold: highConf,
        pendingConfidenceThreshold: pendingConf,
        biometricRetentionDays: retentionDays,
        allowManualFallback,
        totalPeriodsPerDay,
        fullDayCheckpointPeriods: checkpointPeriods,
      });
      setMessage('Institutional attendance, timezone & biometric governance rules saved.');
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHodCheckpoints = async () => {
    if (checkpointPeriods.length === 0) {
      setError('Select at least one checkpoint period for full-day attendance evaluation.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await SmartAttendService.updateCheckpointPeriods(checkpointPeriods, totalPeriodsPerDay);
      setMessage(
        `Saved Full-Day Checkpoint rule: Periods [${checkpointPeriods.join(', ')}] out of ${totalPeriodsPerDay} periods/day.`,
      );
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save checkpoint periods.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await SmartAttendService.updateMyProfile({
        fullName,
        phone,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Account profile updated successfully.');
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkFirebase = async () => {
    setError(null);
    setMessage(null);
    try {
      const fbUser = await linkGoogleFirebaseAuth();
      onFirebaseAuthChanged(fbUser.email ?? fbUser.uid);
      await onRecheckFirebase();
      setMessage(
        `Linked Firebase Auth as ${fbUser.email ?? fbUser.uid}. You can now read and sync Cloud Firestore.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed or cancelled.');
    }
  };

  const handleUnlinkFirebase = async () => {
    await unlinkGoogleFirebaseAuth();
    onFirebaseAuthChanged(null);
    setMessage('Disconnected Firebase Google Auth session.');
  };

  const handleSyncFirestore = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const summary = await FirebaseSyncService.syncWorkspaceToFirestore(data);
      const readCheck = await FirebaseSyncService.verifyFirestoreRead(
        data.user.role,
        data.user.department,
      );
      setMessage(
        `Synchronized ${summary.documentsWritten} document(s) across ${summary.collectionsSynced} Cloud Firestore collections (verified ${readCheck.totalDocumentsRead} readable docs across ${readCheck.collectionsChecked} collections).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud Firestore sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSampleAction = async (mode: 'load' | 'clear') => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'load') {
        await SmartAttendService.loadSampleData();
        setMessage('Loaded Sample Demonstration Dataset cleanly into the database.');
      } else {
        await SmartAttendService.clearSampleData();
        setMessage('Cleared sample demonstration records while preserving real records.');
      }
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample data operation failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-[#10B981]/35 bg-[#ECFDF5] px-4 py-2.5 text-xs font-medium text-[#065F46]">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Firebase Cloud Firestore Integration Status */}
      <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
              <Cloud className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
              <span>Cloud Firestore Synchronization</span>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                  firebaseStatus.reachable
                    ? 'border-[#10B981]/35 bg-[#ECFDF5] text-[#065F46]'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                {firebaseStatus.reachable ? 'CONNECTED' : 'CHECK REQUIRED'}
              </span>
            </h3>
            <p className="mt-1 text-xs text-[#475569]">
              Project <code className="font-mono font-semibold text-[#059669]">{firebaseStatus.projectId}</code> · Database{' '}
              <code className="font-mono font-semibold text-[#059669]">{firebaseStatus.databaseId}</code>
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Diagnostic: {firebaseStatus.diagnosticMessage}{' '}
              {firebaseUserEmail
                ? `· Authenticated as ${firebaseUserEmail}`
                : '· Connect Google Sign-In to authorize Cloud Firestore client reads & writes.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRecheckFirebase()}
              className="rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
            >
              Test Connection
            </button>
            {!firebaseUserEmail ? (
              <button
                type="button"
                onClick={() => void handleLinkFirebase()}
                className="rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                Connect Google Auth
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleSyncFirestore()}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync to Firestore Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleUnlinkFirebase()}
                  className="rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs font-medium text-[#475569] hover:border-red-300 hover:text-red-700"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {isAdmin ? (
        <>
          <form
            onSubmit={handleSaveSettings}
            className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs"
          >
            <div className="flex items-center gap-2 border-b border-[#E2EFE8] pb-3">
              <ShieldCheck className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
              <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                Institution Rules, Timezone, Checkpoint Periods &amp; Biometric Retention
              </h3>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">Institution Name</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">Institution Code</label>
                <input
                  type="text"
                  value={institutionCode}
                  onChange={(e) => setInstitutionCode(e.target.value)}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Institution Timezone
                </label>
                <select
                  value={institutionTimezone}
                  onChange={(e) => setInstitutionTimezone(e.target.value)}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Low-Attendance Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={99}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  High-Confidence Auto Present (0.40 – 0.99)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.4}
                  max={0.99}
                  value={highConf}
                  onChange={(e) => setHighConf(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Pending Verification Lower Bound
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.2}
                  max={0.95}
                  value={pendingConf}
                  onChange={(e) => setPendingConf(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Biometric Template Retention (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Periods Per Day
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={totalPeriodsPerDay}
                  onChange={(e) => setTotalPeriodsPerDay(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Full-Day Checkpoint Periods
                </label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Array.from({ length: totalPeriodsPerDay }, (_, i) => i + 1).map((p) => {
                    const active = checkpointPeriods.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleCheckpointPeriod(p)}
                        className={`rounded border px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                          active
                            ? 'border-[#10B981] bg-[#ECFDF5] text-[#065F46]'
                            : 'border-[#D1E7DC] bg-white text-[#64748B]'
                        }`}
                      >
                        P{p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2EFE8] pt-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#172B2A]">
                <input
                  type="checkbox"
                  checked={allowManualFallback}
                  onChange={(e) => setAllowManualFallback(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#10B981]"
                />
                <span>Allow non-biometric manual attendance fallback for all students</span>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                Save Institutional Rules
              </button>
            </div>
          </form>

          {/* Optional Sample Demonstration Data Controls */}
          <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                  Optional Sample Demonstration Data
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  Load realistic college sample students and historical sessions across CSE, IT,
                  AIML, and AIDS, or clear sample rows at any time to start clean.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSampleAction('load')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#10B981] bg-[#ECFDF5] px-3.5 py-2 text-xs font-semibold text-[#065F46] hover:bg-[#10B981] hover:text-white"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Load Sample Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSampleAction('clear')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1E7DC] bg-white px-3.5 py-2 text-xs font-medium text-[#475569] hover:border-red-300 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear Sample Data</span>
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="space-y-6">
          {/* HOD Full-Day Checkpoint Periods Card */}
          <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2EFE8] pb-3">
              <div>
                <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                  <CalendarCheck2 className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                  <span>Full-Day Attendance Checkpoint Configuration</span>
                </h3>
                <p className="mt-0.5 text-[11px] text-[#475569]">
                  Timezone: <strong className="font-mono text-[#172B2A]">{data.settings.institutionTimezone}</strong> · Choose which periods determine Full-Day Present / Half-Day / Absent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveHodCheckpoints()}
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                Save Checkpoints
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {Array.from({ length: totalPeriodsPerDay }, (_, i) => i + 1).map((p) => {
                const active = checkpointPeriods.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleCheckpointPeriod(p)}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#10B981] bg-[#ECFDF5] text-[#065F46]'
                        : 'border-[#D1E7DC] bg-white text-[#475569] hover:border-[#10B981]'
                    }`}
                  >
                    Period {p} {active ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </section>

          {/* HOD Profile View */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-[#E2EFE8] pb-3">
              <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                <Lock className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                <span>HOD Profile · Locked to {data.user.department}</span>
              </h3>
              <span className="font-mono text-xs font-semibold text-[#059669]">
                {data.user.loginId}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">
                  Current Password (to change)
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#172B2A]">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                Update Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
