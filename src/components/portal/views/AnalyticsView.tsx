import { useMemo } from 'react';
import { AlertTriangle, BarChart3, BookOpen, TrendingUp } from 'lucide-react';
import type { DepartmentCode } from '../../../types/auth';
import { ACADEMIC_YEARS, type WorkspaceBootstrapData } from '../../../types/smartattend';
import { isAttendanceConsideredPresent } from '../../../utils/fullDayAttendance';

interface AnalyticsViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
}

export function AnalyticsView({ data, isAdmin, lockedDepartment }: AnalyticsViewProps) {
  const threshold = data.settings.lowAttendanceThreshold;

  const countableAttendance = useMemo(
    () =>
      data.attendance.filter(
        (a) =>
          a.status !== 'PENDING_VERIFICATION' &&
          a.status !== 'UNKNOWN' &&
          (!lockedDepartment || a.department === lockedDepartment),
      ),
    [data.attendance, lockedDepartment],
  );

  const cohortBreakdown = useMemo(() => {
    if (isAdmin && !lockedDepartment) {
      return data.departments.map((dept) => {
        const recs = countableAttendance.filter((a) => a.department === dept.code);
        const present = recs.filter((r) => isAttendanceConsideredPresent(r.status)).length;
        const rate = recs.length > 0 ? (present / recs.length) * 100 : 0;
        return {
          key: dept.id,
          title: `${dept.code} · ${dept.name}`,
          total: recs.length,
          present,
          rate,
        };
      });
    }
    return ACADEMIC_YEARS.map((year) => {
      const recs = countableAttendance.filter((a) => a.academicYear === year);
      const present = recs.filter((r) => isAttendanceConsideredPresent(r.status)).length;
      const rate = recs.length > 0 ? (present / recs.length) * 100 : 0;
      return {
        key: year,
        title: year,
        total: recs.length,
        present,
        rate,
      };
    });
  }, [isAdmin, lockedDepartment, data.departments, countableAttendance]);

  const subjectBreakdown = useMemo(() => {
    const subs = lockedDepartment
      ? data.subjects.filter((s) => s.department === lockedDepartment)
      : data.subjects;
    return subs.map((sub) => {
      const recs = countableAttendance.filter((a) => a.subjectId === sub.id);
      const present = recs.filter((r) => isAttendanceConsideredPresent(r.status)).length;
      const rate = recs.length > 0 ? (present / recs.length) * 100 : 0;
      return {
        id: sub.id,
        code: sub.subjectCode,
        name: sub.subjectName,
        faculty: sub.facultyName,
        total: recs.length,
        present,
        rate,
      };
    });
  }, [data.subjects, lockedDepartment, countableAttendance]);

  const atRiskStudents = useMemo(() => {
    const students = lockedDepartment
      ? data.students.filter((s) => s.department === lockedDepartment)
      : data.students;
    const riskList: Array<{
      id: string;
      registerNo: string;
      fullName: string;
      cohort: string;
      present: number;
      total: number;
      rate: number;
    }> = [];

    for (const stu of students) {
      const recs = countableAttendance.filter((a) => a.studentId === stu.id);
      if (recs.length === 0) continue;
      const present = recs.filter((r) => isAttendanceConsideredPresent(r.status)).length;
      const rate = (present / recs.length) * 100;
      if (rate < threshold) {
        riskList.push({
          id: stu.id,
          registerNo: stu.registerNo,
          fullName: stu.fullName,
          cohort: `${stu.department} ${stu.academicYear} Sec ${stu.section}`,
          present,
          total: recs.length,
          rate,
        });
      }
    }
    return riskList.sort((a, b) => a.rate - b.rate);
  }, [data.students, lockedDepartment, countableAttendance, threshold]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
          Institutional Attendance Analytics
        </h2>
        <p className="text-xs text-slate-600">
          Live computed metrics strictly from recorded period attendance sessions (no synthetic estimates).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#D1E7DC] pb-3">
            <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              <BarChart3 className="h-4 w-4 text-[#059669]" aria-hidden="true" />
              <span>{isAdmin ? 'Department Attendance Comparison' : 'Academic Year Comparison'}</span>
            </h3>
            <span className="font-mono text-[11px] text-slate-500">Target &ge; {threshold}%</span>
          </div>

          <div className="mt-4 space-y-4">
            {cohortBreakdown.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#172B2A]">{item.title}</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {item.present}/{item.total} periods ·{' '}
                    <strong className={item.rate < threshold && item.total > 0 ? 'text-rose-700' : 'text-[#059669]'}>
                      {item.total > 0 ? `${item.rate.toFixed(1)}%` : 'No data'}
                    </strong>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E6F2EC]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.rate < threshold && item.total > 0 ? 'bg-amber-500' : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, item.rate))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#D1E7DC] pb-3">
            <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              <BookOpen className="h-4 w-4 text-[#059669]" aria-hidden="true" />
              <span>Subject-wise Attendance Standing</span>
            </h3>
            <span className="font-mono text-[11px] text-slate-500">
              {subjectBreakdown.length} subject(s)
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {subjectBreakdown.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] px-3.5 py-2.5 text-xs"
              >
                <div>
                  <div className="font-medium text-[#172B2A]">
                    <span className="font-mono text-[#059669]">{sub.code}</span> · {sub.name}
                  </div>
                  <div className="text-[11px] text-slate-500">Faculty: {sub.faculty}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="font-semibold text-[#172B2A]">
                    {sub.total > 0 ? `${sub.rate.toFixed(1)}%` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {sub.present}/{sub.total} records
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Low Attendance Watchlist */}
      <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D1E7DC] pb-3">
          <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <span>Students Below {threshold}% Attendance Threshold</span>
          </h3>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-600">
            <TrendingUp className="h-3.5 w-3.5 text-[#059669]" />
            <span>{atRiskStudents.length} flagged</span>
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#D1E7DC] bg-[#F8FCF9] text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Register No</th>
                <th className="px-4 py-2.5 font-medium">Student Name</th>
                <th className="px-4 py-2.5 font-medium">Cohort</th>
                <th className="px-4 py-2.5 font-medium">Attended / Total</th>
                <th className="px-4 py-2.5 font-medium">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6F2EC]">
              {atRiskStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No students are currently below the {threshold}% attendance threshold.
                  </td>
                </tr>
              ) : (
                atRiskStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8FCF9]">
                    <td className="px-4 py-2.5 font-mono text-[#172B2A]">{s.registerNo}</td>
                    <td className="px-4 py-2.5 font-medium text-[#172B2A]">{s.fullName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.cohort}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {s.present}/{s.total}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold tabular-nums text-rose-700">
                      {s.rate.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
