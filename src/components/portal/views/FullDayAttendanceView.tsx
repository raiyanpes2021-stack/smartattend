import { useMemo, useState } from 'react';
import { CalendarCheck2, CheckSquare, Save } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type AcademicYear,
  type SectionCode,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';
import { evaluateFullDayAttendanceForDate } from '../../../utils/fullDayAttendance';

interface FullDayAttendanceViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
}

export function FullDayAttendanceView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
}: FullDayAttendanceViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const latestSessionDate = data.sessions[0]?.sessionDate;
    return latestSessionDate || new Date().toISOString().slice(0, 10);
  });
  const [deptFilter, setDeptFilter] = useState<string>(
    lockedDepartment ?? data.departments[0]?.code ?? 'CSE',
  );
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [checkpointPeriods, setCheckpointPeriods] = useState<number[]>(
    data.settings.fullDayCheckpointPeriods ?? [1, 4, 7],
  );
  const [savingConfig, setSavingConfig] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxPeriods = data.settings.totalPeriodsPerDay || 7;

  const filteredStudents = useMemo(
    () =>
      data.students.filter((s) => {
        if (s.enrollmentStatus !== 'ACTIVE') return false;
        if (deptFilter !== 'ALL' && s.department !== deptFilter) return false;
        if (yearFilter !== 'ALL' && s.academicYear !== (yearFilter as AcademicYear)) return false;
        if (sectionFilter !== 'ALL' && s.section !== (sectionFilter as SectionCode)) return false;
        return true;
      }),
    [data.students, deptFilter, yearFilter, sectionFilter],
  );

  const evaluations = useMemo(
    () =>
      evaluateFullDayAttendanceForDate({
        date: selectedDate,
        students: filteredStudents,
        attendance: data.attendance,
        sessions: data.sessions,
        periods: data.timetablePeriods,
        holidays: data.holidays,
        overrides: data.timetableOverrides,
        checkpointPeriods,
      }),
    [
      selectedDate,
      filteredStudents,
      data.attendance,
      data.sessions,
      data.timetablePeriods,
      data.holidays,
      data.timetableOverrides,
      checkpointPeriods,
    ],
  );

  const counts = useMemo(() => {
    let fullPresent = 0;
    let fullAbsent = 0;
    let pending = 0;
    let holiday = 0;
    for (const ev of evaluations) {
      if (ev.fullDayStatus === 'FULL_DAY_PRESENT') fullPresent += 1;
      else if (ev.fullDayStatus === 'FULL_DAY_ABSENT') fullAbsent += 1;
      else if (ev.fullDayStatus === 'PENDING_RECORDS') pending += 1;
      else holiday += 1;
    }
    return { fullPresent, fullAbsent, pending, holiday };
  }, [evaluations]);

  const toggleCheckpoint = (periodNum: number) => {
    setCheckpointPeriods((prev) => {
      if (prev.includes(periodNum)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((p) => p !== periodNum);
      }
      return [...prev, periodNum].sort((a, b) => a - b);
    });
  };

  const handleSaveCheckpoints = async () => {
    setSavingConfig(true);
    setError(null);
    setFeedback(null);
    try {
      await SmartAttendService.updateCheckpointPeriods(checkpointPeriods, maxPeriods);
      setFeedback(
        `Saved Full-Day Attendance rule: verified PRESENT required across Period(s) ${checkpointPeriods.join(', ')}.`,
      );
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save checkpoint configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
            Full-Day Attendance Engine
          </h2>
          <p className="text-xs text-slate-600">
            Separate full-day calculation verified strictly across active checkpoint periods.
            Missing checkpoint records remain PENDING (never silently marked Absent), and holidays or
            cancelled periods are excluded without penalizing students.
          </p>
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

      {/* Configurable Checkpoint Periods Card */}
      <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              <CheckSquare className="h-4 w-4 text-[#059669]" aria-hidden="true" />
              <span>HOD Configurable Checkpoint Periods</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              Select which periods verify Full-Day Presence (e.g., Period 1 + Period 4 + Period 7).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveCheckpoints()}
            disabled={savingConfig}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{savingConfig ? 'Saving...' : 'Save Checkpoint Rule'}</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: maxPeriods }, (_, idx) => idx + 1).map((pNum) => {
            const active = checkpointPeriods.includes(pNum);
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => toggleCheckpoint(pNum)}
                className={`rounded-lg border px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#10B981] bg-[#10B981] text-[#06281E]'
                    : 'border-[#CBDCD4] bg-[#F8FCF9] text-slate-600 hover:border-[#10B981]'
                }`}
              >
                Period {pNum}
              </button>
            );
          })}
        </div>
      </section>

      {/* Date & Cohort Filter Bar + KPI Strip */}
      <div className="grid gap-3 rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Attendance Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
          />
        </div>
        {isAdmin && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
            >
              <option value="ALL">All Departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Year</label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">All Years</option>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Section</label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">All Sections</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-600">Full-Day Present</span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#059669]">
            {counts.fullPresent}
          </p>
        </div>
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-600">Full-Day Absent</span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-rose-700">
            {counts.fullAbsent}
          </p>
        </div>
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-600">Pending Checkpoints</span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-amber-700">
            {counts.pending}
          </p>
        </div>
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-600">Holiday / Excluded</span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#172B2A]">
            {counts.holiday}
          </p>
        </div>
      </section>

      {/* Evaluation Table */}
      <div className="overflow-x-auto rounded-xl border border-[#D1E7DC] bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D1E7DC] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-[#059669]" aria-hidden="true" />
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              Full-Day Checkpoint Register · {selectedDate}
            </h3>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Active Rule: P{checkpointPeriods.join(' + P')}
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D1E7DC] bg-[#F8FCF9] text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Roll / Reg No</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Cohort</th>
              <th className="px-4 py-3 font-medium">Checkpoint Breakdown</th>
              <th className="px-4 py-3 font-medium">Full-Day Standing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6F2EC]">
            {evaluations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No students match the selected filter.
                </td>
              </tr>
            ) : (
              evaluations.map((ev) => (
                <tr key={ev.student.id} className="hover:bg-[#F8FCF9]">
                  <td className="px-4 py-3 font-mono tabular-nums">
                    <div className="font-semibold text-[#172B2A]">{ev.student.rollNo}</div>
                    <div className="text-[11px] text-slate-500">{ev.student.registerNo}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#172B2A]">
                    {ev.student.fullName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ev.student.department} · {ev.student.academicYear} Sec {ev.student.section}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ev.checkpoints.map((cp) => (
                        <span
                          key={cp.periodNumber}
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            cp.status === 'PRESENT'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                              : cp.status === 'ABSENT'
                                ? 'border border-rose-200 bg-rose-50 text-rose-800'
                                : cp.status === 'CANCELLED'
                                  ? 'border border-slate-200 bg-slate-100 text-slate-600'
                                  : 'border border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          P{cp.periodNumber}: {cp.status}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                        ev.fullDayStatus === 'FULL_DAY_PRESENT'
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : ev.fullDayStatus === 'FULL_DAY_ABSENT'
                            ? 'border border-rose-200 bg-rose-50 text-rose-800'
                            : ev.fullDayStatus === 'HOLIDAY' ||
                                ev.fullDayStatus === 'NO_ACTIVE_CHECKPOINTS'
                              ? 'border border-slate-200 bg-slate-100 text-slate-600'
                              : 'border border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {ev.fullDayStatus.replace(/_/g, ' ')}
                    </span>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {ev.fullDayStatus === 'HOLIDAY'
                        ? 'Holiday declared — excluded without penalty'
                        : ev.fullDayStatus === 'NO_ACTIVE_CHECKPOINTS'
                          ? 'All checkpoint periods cancelled'
                          : `${ev.presentCheckpointsCount}/${ev.activeCheckpointsCount} present · ${ev.missingCheckpointsCount} pending/missing`}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
