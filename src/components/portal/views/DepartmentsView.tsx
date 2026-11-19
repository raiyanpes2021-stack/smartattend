import { useState, type FormEvent } from 'react';
import { Building2, Edit3, Plus } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentRecord, WorkspaceBootstrapData } from '../../../types/smartattend';

interface DepartmentsViewProps {
  data: WorkspaceBootstrapData;
  onDataChanged: () => Promise<void>;
}

export function DepartmentsView({ data, onDataChanged }: DepartmentsViewProps) {
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hodId, setHodId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setCode('');
    setName('');
    setDescription('');
    setHodId('');
    setActive(true);
    setError(null);
  };

  const openEdit = (dept: DepartmentRecord) => {
    setCreating(false);
    setEditing(dept);
    setCode(dept.code);
    setName(dept.name);
    setDescription(dept.description);
    setHodId(dept.hodId ?? '');
    setActive(dept.active);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.upsertDepartment({
        id: editing?.id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        hodId: hodId || null,
        active,
      });
      setCreating(false);
      setEditing(null);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#172B2A]">
            Academic Departments
          </h2>
          <p className="text-xs text-[#475569]">
            Manage engineering &amp; science departments, HOD assignments, and attendance standing.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#059669]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Add Department</span>
        </button>
      </div>

      {(creating || editing) && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            {editing ? `Edit Department · ${editing.code}` : 'New Academic Department'}
          </h3>
          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Department Code</label>
              <input
                type="text"
                required
                disabled={Boolean(editing)}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ECE"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] disabled:bg-slate-100 disabled:text-slate-500 focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Department Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Electronics & Communication Engineering"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Assigned HOD</label>
              <select
                value={hodId}
                onChange={(e) => setHodId(e.target.value)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              >
                <option value="">Unassigned</option>
                {data.hods.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.fullName} ({h.loginId})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Core curriculum focus & labs"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-[#172B2A]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#10B981]"
                />
                <span>Department Active</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="rounded-lg border border-[#D1E7DC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#475569] hover:border-[#10B981]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#059669] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Department'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.departments.map((dept) => {
          const studentsCount = data.students.filter((s) => s.department === dept.code).length;
          const roomsCount = data.classrooms.filter((c) => c.department === dept.code).length;
          const deptAtt = data.attendance.filter(
            (a) =>
              a.department === dept.code &&
              a.status !== 'PENDING_VERIFICATION' &&
              a.status !== 'UNKNOWN',
          );
          const presentCount = deptAtt.filter(
            (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
          ).length;
          const rate = deptAtt.length > 0 ? (presentCount / deptAtt.length) * 100 : 0;

          return (
            <div
              key={dept.id}
              className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#ECFDF5] font-mono text-xs font-bold text-[#059669]">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#059669]">{dept.code}</span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                          dept.active
                            ? 'border-[#10B981]/35 bg-[#ECFDF5] text-[#065F46]'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        }`}
                      >
                        {dept.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="mt-0.5 font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                      {dept.name}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(dept)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D1E7DC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                >
                  <Edit3 className="h-3 w-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
              </div>

              {dept.description && (
                <p className="mt-2.5 text-xs text-[#475569]">{dept.description}</p>
              )}

              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[#E2EFE8] pt-3 text-xs">
                <div>
                  <span className="block text-[10px] text-[#64748B]">Assigned HOD</span>
                  <span className="font-semibold text-[#172B2A]">
                    {dept.hodName ?? 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#64748B]">Students</span>
                  <span className="font-mono font-semibold tabular-nums text-[#172B2A]">
                    {studentsCount}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#64748B]">Classrooms</span>
                  <span className="font-mono font-semibold tabular-nums text-[#172B2A]">
                    {roomsCount}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#64748B]">Attendance</span>
                  <span className="font-mono font-semibold tabular-nums text-[#059669]">
                    {rate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
