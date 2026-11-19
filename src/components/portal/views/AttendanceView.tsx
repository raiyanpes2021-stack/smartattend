import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardEdit } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import type {
  AttendanceStatus,
  ClassSessionRecord,
  WorkspaceBootstrapData,
} from '../../../types/smartattend';

interface AttendanceViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
}

export function AttendanceView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
}: AttendanceViewProps) {
  const [deptFilter, setDeptFilter] = useState<string>(lockedDepartment ?? 'ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    data.sessions[0]?.id ?? '',
  );

  const [editingStudent, setEditingStudent] = useState<{
    studentId: string;
    studentName: string;
    currentStatus: AttendanceStatus | 'UNMARKED';
  } | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredSessions = useMemo(
    () =>
      data.sessions.filter((s) => {
        if (deptFilter !== 'ALL' && s.department !== deptFilter) return false;
        if (dateFilter && s.sessionDate !== dateFilter) return false;
        if (periodFilter !== 'ALL' && String(s.periodNumber ?? 1) !== periodFilter) return false;
        return true;
      }),
    [data.sessions, deptFilter, dateFilter, periodFilter],
  );

  const activeSession: ClassSessionRecord | null =
    filteredSessions.find((s) => s.id === selectedSessionId) ??
    filteredSessions[0] ??
    null;

  const sessionCohort = useMemo(() => {
    if (!activeSession) return [];
    return data.students.filter(
      (st) =>
        st.department === activeSession.department &&
        st.academicYear === activeSession.academicYear &&
        st.section === activeSession.section,
    );
  }, [data.students, activeSession]);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, (typeof data.attendance)[number]>();
    if (!activeSession) return map;
    for (const rec of data.attendance) {
      if (rec.sessionId === activeSession.id) {
        map.set(rec.studentId, rec);
      }
    }
    return map;
  }, [data.attendance, activeSession]);

  const handleFinalize = async (sessionId: string) => {
    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      const res = await SmartAttendService.finalizeSession(sessionId);
      setFeedback(
        `Session finalized. ${res.newlyMarkedAbsent} unmarked student(s) transitioned to ABSENT.`,
      );
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finalize session.');
    } finally {
      setSaving(false);
    }
  };

  const handleCorrectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSession || !editingStudent) return;
    if (!correctionReason.trim()) {
      setError('A documented reason is required for attendance edits and audit logging.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.markAttendance({
        sessionId: activeSession.id,
        studentId: editingStudent.studentId,
        status: newStatus,
        verificationSource: 'HOD_CORRECTION',
        correctionReason: correctionReason.trim(),
      });
      setFeedback(
        `Updated ${editingStudent.studentName} to ${newStatus} with audit trail recorded.`,
      );
      setEditingStudent(null);
      setCorrectionReason('');
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
            Period-Wise Attendance Ledger &amp; Corrections
          </h2>
          <p className="text-xs text-slate-600">
            Duplicate-safe period records (`Present`, `Absent`, `Late`, `Pending Verification`,
            `Manually Corrected`, `Excused`) with recognition timestamps and auditable overrides.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-1.5 text-xs text-[#0F1F1E]"
            >
              <option value="ALL">All Departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code}
                </option>
              ))}
            </select>
          )}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-1.5 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">All Periods</option>
            {[1, 2, 3, 4, 5, 6, 7].map((p) => (
              <option key={p} value={String(p)}>
                Period {p}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-1.5 font-mono text-xs text-[#0F1F1E]"
          />
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Session Selector Column */}
        <section className="space-y-2.5 rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs lg:col-span-4">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
            Period Sessions ({filteredSessions.length})
          </h3>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No class sessions recorded for this filter. Start one in Live Cameras or Classrooms.
              </p>
            ) : (
              filteredSessions.map((sess) => {
                const selected = activeSession?.id === sess.id;
                return (
                  <button
                    key={sess.id}
                    type="button"
                    onClick={() => setSelectedSessionId(sess.id)}
                    className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                      selected
                        ? 'border-[#10B981] bg-[#F0FDF4]'
                        : 'border-[#D1E7DC] bg-white hover:border-[#10B981]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[#059669]">
                        {sess.periodLabel || `Period ${sess.periodNumber}`} · {sess.department}
                      </span>
                      <span className="rounded border border-[#D1E7DC] bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                        {sess.status}
                      </span>
                    </div>
                    <div className="mt-1 font-medium text-[#172B2A]">{sess.subjectName}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      {sess.academicYear} Sec {sess.section} · {sess.sessionDate} · {sess.startTime}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Roster Column */}
        <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs lg:col-span-8">
          {!activeSession ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Select a period session to inspect and manage student attendance.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D1E7DC] pb-3">
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[#172B2A]">
                    {activeSession.subjectName} ({activeSession.periodLabel})
                  </h3>
                  <p className="font-mono text-xs text-[#059669]">
                    {activeSession.department} · {activeSession.academicYear} Sec{' '}
                    {activeSession.section} · {activeSession.sessionDate} ({activeSession.status})
                  </p>
                </div>
                {activeSession.status !== 'FINALIZED' && (
                  <button
                    type="button"
                    onClick={() => void handleFinalize(activeSession.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Finalize Session</span>
                  </button>
                )}
              </div>

              {editingStudent && (
                <form
                  onSubmit={handleCorrectionSubmit}
                  className="rounded-xl border border-[#10B981]/50 bg-[#F8FCF9] p-4"
                >
                  <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold text-[#172B2A]">
                    Edit Attendance · {editingStudent.studentName}
                  </h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-600">New Status</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as AttendanceStatus)}
                        className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
                      >
                        <option value="PRESENT">PRESENT</option>
                        <option value="ABSENT">ABSENT</option>
                        <option value="LATE">LATE</option>
                        <option value="EXCUSED">EXCUSED</option>
                        <option value="MANUALLY_CORRECTED">MANUALLY_CORRECTED</option>
                        <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] text-slate-600">
                        Mandatory Correction / Audit Reason
                      </label>
                      <input
                        type="text"
                        required
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        placeholder="e.g., Medical excuse verified, student entered late after camera cycle"
                        className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(null)}
                      className="rounded border border-[#CBDCD4] bg-white px-3 py-1 text-xs text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded bg-[#10B981] px-3.5 py-1 text-xs font-semibold text-[#06281E]"
                    >
                      Save Audited Change
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#D1E7DC] bg-[#F8FCF9] text-slate-600">
                    <tr>
                      <th className="py-2.5 pr-3 font-medium">Reg / Roll</th>
                      <th className="py-2.5 pr-3 font-medium">Student Name</th>
                      <th className="py-2.5 pr-3 font-medium">Status</th>
                      <th className="py-2.5 pr-3 font-medium">Source / Verification</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6F2EC]">
                    {sessionCohort.map((stu) => {
                      const rec = attendanceByStudent.get(stu.id);
                      const status = rec
                        ? rec.status
                        : activeSession.status === 'FINALIZED'
                          ? 'ABSENT'
                          : 'IN_PROGRESS';

                      return (
                        <tr key={stu.id} className="hover:bg-[#F8FCF9]">
                          <td className="py-2.5 pr-3 font-mono text-[#172B2A]">
                            <div>{stu.registerNo}</div>
                            <div className="text-[10px] text-slate-500">{stu.rollNo}</div>
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-[#172B2A]">
                            <div>{stu.fullName}</div>
                            {rec?.correctionReason && (
                              <div className="text-[10px] text-slate-500">
                                Note: {rec.correctionReason}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                status === 'PRESENT' ||
                                status === 'LATE' ||
                                status === 'EXCUSED' ||
                                status === 'MANUALLY_CORRECTED'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : status === 'ABSENT'
                                    ? 'border border-rose-200 bg-rose-50 text-rose-800'
                                    : 'border border-slate-200 bg-slate-100 text-slate-600'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-600">
                            {rec ? (
                              <div>
                                <div>
                                  {rec.verificationStatus ?? rec.verificationSource}
                                  {rec.confidence !== null
                                    ? ` · ${(rec.confidence * 100).toFixed(0)}%`
                                    : ''}
                                </div>
                                {rec.recognitionTimestamp && (
                                  <div className="text-[10px] text-slate-500">
                                    AI Time: {new Date(rec.recognitionTimestamp).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              'Unmarked'
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudent({
                                  studentId: stu.id,
                                  studentName: stu.fullName,
                                  currentStatus: rec?.status ?? 'UNMARKED',
                                });
                                setNewStatus(rec?.status ?? 'PRESENT');
                                setCorrectionReason('');
                              }}
                              className="inline-flex items-center gap-1 rounded border border-[#CBDCD4] bg-white px-2.5 py-1 text-[11px] text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                            >
                              <ClipboardEdit className="h-3 w-3" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
