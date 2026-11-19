import { useState, type FormEvent } from 'react';
import { Edit3, KeyRound, Plus } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { AuthUser, DepartmentCode } from '../../../types/auth';
import type { WorkspaceBootstrapData } from '../../../types/smartattend';

interface HodManagementViewProps {
  data: WorkspaceBootstrapData;
  onDataChanged: () => Promise<void>;
}

export function HodManagementView({ data, onDataChanged }: HodManagementViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingHod, setEditingHod] = useState<AuthUser | null>(null);
  const [resettingHod, setResettingHod] = useState<AuthUser | null>(null);

  const [hodId, setHodId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<DepartmentCode>('CSE');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deptCodes = data.departments.map((d) => d.code);

  const openCreate = () => {
    setEditingHod(null);
    setResettingHod(null);
    setShowCreate(true);
    setHodId('');
    setFullName('');
    setEmail('');
    setPhone('');
    setDepartment(deptCodes[0] ?? 'CSE');
    setPassword('');
    setActive(true);
    setError(null);
    setFeedback(null);
  };

  const openEdit = (hod: AuthUser) => {
    setShowCreate(false);
    setResettingHod(null);
    setEditingHod(hod);
    setFullName(hod.fullName);
    setEmail(hod.email);
    setPhone(hod.phone ?? '');
    setDepartment(hod.department ?? 'CSE');
    setActive(hod.active);
    setError(null);
    setFeedback(null);
  };

  const openReset = (hod: AuthUser) => {
    setShowCreate(false);
    setEditingHod(null);
    setResettingHod(hod);
    setPassword('');
    setError(null);
    setFeedback(null);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await SmartAttendService.createHod({
        hodId: hodId.trim().toUpperCase(),
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        temporaryPassword: password,
        active,
      });
      setShowCreate(false);
      setFeedback(`Created HOD ${res.account.loginId} for ${res.account.department}.`);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create HOD account.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingHod) return;
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.updateHod(editingHod.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        active,
      });
      setEditingHod(null);
      setFeedback(`Updated HOD profile for ${editingHod.loginId}.`);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update HOD account.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resettingHod) return;
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.resetHodPassword(resettingHod.id, password);
      setFeedback(`Password updated for ${resettingHod.loginId}.`);
      setResettingHod(null);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (hod: AuthUser) => {
    try {
      await SmartAttendService.updateHod(hod.id, { active: !hod.active });
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update HOD status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#172B2A]">
            HOD Account Management
          </h2>
          <p className="text-xs text-[#475569]">
            Provision, assign, suspend, and reset passwords for department-locked HOD accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#059669]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Create HOD Account</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-[#10B981]/35 bg-[#ECFDF5] px-4 py-2.5 text-xs font-medium text-[#065F46]">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            Provision New HOD Account
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Employee / HOD ID</label>
              <input
                type="text"
                required
                value={hodId}
                onChange={(e) => setHodId(e.target.value)}
                placeholder="HOD-CSE-02"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Rajeshwari Menon"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Institutional Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rajeshwari@smartattend.edu"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              >
                {deptCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98400 00000"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Initial Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, letters + digits"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-[#D1E7DC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#475569]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#059669] disabled:opacity-60"
            >
              {saving ? 'Provisioning...' : 'Provision HOD'}
            </button>
          </div>
        </form>
      )}

      {editingHod && (
        <form
          onSubmit={handleUpdate}
          className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            Edit HOD · {editingHod.loginId}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Assigned Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              >
                {deptCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingHod(null)}
              className="rounded-lg border border-[#D1E7DC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#475569]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#059669]"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {resettingHod && (
        <form
          onSubmit={handleResetPassword}
          className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            Reset Password · {resettingHod.loginId} ({resettingHod.fullName})
          </h3>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, letters + numbers"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResettingHod(null)}
                className="rounded-lg border border-[#D1E7DC] bg-white px-3.5 py-2 text-xs font-medium text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                Update Password
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#D1E7DC] bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E2EFE8] bg-[#F8FCF9] text-[#475569]">
            <tr>
              <th className="px-4 py-3 font-semibold">HOD ID</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2EFE8]">
            {data.hods.map((hod) => (
              <tr key={hod.id} className="hover:bg-[#F0FDF4]/60">
                <td className="px-4 py-3 font-mono font-semibold text-[#172B2A]">
                  {hod.loginId}
                </td>
                <td className="px-4 py-3 font-semibold text-[#172B2A]">{hod.fullName}</td>
                <td className="px-4 py-3 font-mono font-bold text-[#059669]">
                  {hod.department ?? 'N/A'}
                </td>
                <td className="px-4 py-3 text-[#475569]">
                  <div>{hod.email}</div>
                  {hod.phone && <div className="font-mono text-[11px]">{hod.phone}</div>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                      hod.active
                        ? 'border-[#10B981]/35 bg-[#ECFDF5] text-[#065F46]'
                        : 'border-slate-200 bg-slate-100 text-slate-500'
                    }`}
                  >
                    {hod.active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(hod)}
                      className="inline-flex items-center gap-1 rounded border border-[#D1E7DC] bg-white px-2 py-1 text-[11px] font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                    >
                      <Edit3 className="h-3 w-3" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openReset(hod)}
                      className="inline-flex items-center gap-1 rounded border border-[#D1E7DC] bg-white px-2 py-1 text-[11px] font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                    >
                      <KeyRound className="h-3 w-3" aria-hidden="true" />
                      <span>Reset PW</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(hod)}
                      className="rounded border border-[#D1E7DC] bg-white px-2 py-1 text-[11px] font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                    >
                      {hod.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
