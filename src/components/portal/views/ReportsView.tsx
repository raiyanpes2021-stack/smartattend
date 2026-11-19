import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  exportAttendanceCsv,
  exportAttendanceExcel,
  exportAttendancePdf,
  exportMonthlyAttendanceWorkbook,
  exportSubjectWiseWorkbook,
  type MonthlyAttendanceExportRow,
  type ReportExportRow,
  type SubjectPeriodExportRow,
  type SubjectSummaryExportRow,
} from '../../../services/ReportExporter';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';
import {
  evaluateFullDayAttendanceForDate,
  isAttendanceConsideredPresent,
} from '../../../utils/fullDayAttendance';

interface ReportsViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  defaultScope?: ReportScope;
}

export type ReportScope =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'DEPARTMENT'
  | 'YEAR'
  | 'SECTION'
  | 'STUDENT'
  | 'SUBJECT';

export function ReportsView({
  data,
  isAdmin,
  lockedDepartment,
  defaultScope = 'MONTHLY',
}: ReportsViewProps) {
  const [scope, setScope] = useState<ReportScope>(defaultScope);
  const [deptFilter, setDeptFilter] = useState<string>(lockedDepartment ?? 'ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>(
    () => data.subjects.find((s) => !lockedDepartment || s.department === lockedDepartment)?.id ?? 'ALL',
  );
  const [monthKey, setMonthKey] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [studentQuery, setStudentQuery] = useState('');

  useEffect(() => {
    setScope(defaultScope);
  }, [defaultScope]);

  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const dateCutoff = useMemo(() => {
    const now = new Date();
    if (scope === 'DAILY') return now.toISOString().slice(0, 10);
    if (scope === 'WEEKLY') {
      return new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    }
    if (scope === 'MONTHLY') {
      return `${monthKey}-01`;
    }
    return '';
  }, [scope, monthKey]);

  const reportRows = useMemo<ReportExportRow[]>(() => {
    const threshold = data.settings.lowAttendanceThreshold;
    const rows: ReportExportRow[] = [];

    for (const stu of data.students) {
      if (deptFilter !== 'ALL' && stu.department !== deptFilter) continue;
      if (yearFilter !== 'ALL' && stu.academicYear !== yearFilter) continue;
      if (sectionFilter !== 'ALL' && stu.section !== sectionFilter) continue;
      if (
        scope === 'STUDENT' &&
        studentQuery.trim() &&
        !`${stu.fullName} ${stu.registerNo}`
          .toLowerCase()
          .includes(studentQuery.trim().toLowerCase())
      ) {
        continue;
      }

      const records = data.attendance.filter((a) => {
        if (a.studentId !== stu.id) return false;
        if (a.status === 'PENDING_VERIFICATION' || a.status === 'UNKNOWN') return false;
        if (scope === 'MONTHLY' && !a.sessionDate.startsWith(monthKey)) return false;
        if (scope !== 'MONTHLY' && dateCutoff && a.sessionDate < dateCutoff) return false;
        if (scope === 'SUBJECT' && subjectFilter !== 'ALL' && a.subjectId !== subjectFilter) {
          return false;
        }
        return true;
      });

      const attendedSessions = records.filter((r) => isAttendanceConsideredPresent(r.status)).length;
      const lateSessions = records.filter((r) => r.status === 'LATE').length;
      const absentSessions = records.filter((r) => r.status === 'ABSENT').length;
      const totalSessions = records.length;
      const attendancePercent =
        totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 100;

      const alertStatus =
        totalSessions === 0
          ? 'No Sessions'
          : attendancePercent < threshold
            ? `Below ${threshold}% Alert`
            : 'Compliant';

      rows.push({
        registerNo: stu.registerNo,
        studentName: stu.fullName,
        department: stu.department,
        academicYear: stu.academicYear,
        section: stu.section,
        totalSessions,
        attendedSessions,
        absentSessions,
        lateSessions,
        attendancePercent,
        alertStatus,
      });
    }

    return rows.sort((a, b) => a.attendancePercent - b.attendancePercent);
  }, [
    data.students,
    data.attendance,
    data.settings.lowAttendanceThreshold,
    deptFilter,
    yearFilter,
    sectionFilter,
    subjectFilter,
    scope,
    monthKey,
    studentQuery,
    dateCutoff,
  ]);

  const lowAttendanceRows = reportRows.filter(
    (r) =>
      r.totalSessions > 0 && r.attendancePercent < data.settings.lowAttendanceThreshold,
  );

  const avgAttendance =
    reportRows.filter((r) => r.totalSessions > 0).length > 0
      ? reportRows
          .filter((r) => r.totalSessions > 0)
          .reduce((acc, r) => acc + r.attendancePercent, 0) /
        reportRows.filter((r) => r.totalSessions > 0).length
      : 0;

  const selectedSubject = data.subjects.find((s) => s.id === subjectFilter);

  const handleExportSubjectExcel = () => {
    const targetSub =
      selectedSubject ??
      data.subjects.find((s) => deptFilter === 'ALL' || s.department === deptFilter);
    const subLabel = targetSub
      ? `${targetSub.subjectCode}_${targetSub.subjectName}`
      : 'All_Subjects';

    const scopedStudents = data.students.filter(
      (stu) =>
        (deptFilter === 'ALL' || stu.department === deptFilter) &&
        (yearFilter === 'ALL' || stu.academicYear === yearFilter) &&
        (sectionFilter === 'ALL' || stu.section === sectionFilter),
    );

    const periodRows: SubjectPeriodExportRow[] = [];
    const summaryRows: SubjectSummaryExportRow[] = [];

    for (const stu of scopedStudents) {
      const subRecs = data.attendance
        .filter(
          (a) =>
            a.studentId === stu.id &&
            (!targetSub || subjectFilter === 'ALL' || a.subjectId === targetSub.id) &&
            a.status !== 'PENDING_VERIFICATION',
        )
        .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

      for (const rec of subRecs) {
        periodRows.push({
          rollNo: stu.rollNo,
          studentName: stu.fullName,
          date: rec.sessionDate,
          period: rec.periodLabel || `Period ${rec.periodNumber ?? 1}`,
          subject: rec.subjectName || targetSub?.subjectName || rec.subjectId,
          status: rec.status,
        });
      }

      const presentPeriods = subRecs.filter((r) => isAttendanceConsideredPresent(r.status)).length;
      const absentPeriods = subRecs.filter((r) => r.status === 'ABSENT').length;
      summaryRows.push({
        rollNo: stu.rollNo,
        registerNo: stu.registerNo,
        studentName: stu.fullName,
        totalClasses: subRecs.length,
        presentPeriods,
        absentPeriods,
        attendancePercent: subRecs.length > 0 ? (presentPeriods / subRecs.length) * 100 : 0,
      });
    }

    exportSubjectWiseWorkbook(subLabel, periodRows, summaryRows);
  };

  const handleExportMonthlyExcel = () => {
    const [yrStr, moStr] = monthKey.split('-');
    const yearNum = Number(yrStr) || new Date().getFullYear();
    const monthNum = Number(moStr) || new Date().getMonth() + 1;
    const daysCount = new Date(yearNum, monthNum, 0).getDate();
    const monthShort = new Date(yearNum, monthNum - 1, 1).toLocaleString('en-US', {
      month: 'short',
    });

    const dayColumns = Array.from({ length: daysCount }, (_, i) => {
      const dStr = String(i + 1).padStart(2, '0');
      const fullDate = `${yrStr}-${String(monthNum).padStart(2, '0')}-${dStr}`;
      return { date: fullDate, header: `${dStr} ${monthShort}` };
    });

    const scopedStudents = data.students.filter(
      (stu) =>
        stu.enrollmentStatus === 'ACTIVE' &&
        (deptFilter === 'ALL' || stu.department === deptFilter) &&
        (yearFilter === 'ALL' || stu.academicYear === yearFilter) &&
        (sectionFilter === 'ALL' || stu.section === sectionFilter),
    );

    const rowMap = new Map<string, MonthlyAttendanceExportRow>();
    for (const stu of scopedStudents) {
      rowMap.set(stu.id, {
        rollNo: stu.rollNo,
        studentName: stu.fullName,
        dailyMarks: {},
        totalWorkingDays: 0,
        fullDaysPresent: 0,
        fullDaysAbsent: 0,
        attendancePercent: 0,
      });
    }

    const checkpoints = data.settings.fullDayCheckpointPeriods ?? [1, 4, 7];

    for (const col of dayColumns) {
      const dayEvaluations = evaluateFullDayAttendanceForDate({
        date: col.date,
        students: scopedStudents,
        attendance: data.attendance,
        sessions: data.sessions,
        periods: data.timetablePeriods,
        holidays: data.holidays,
        overrides: data.timetableOverrides,
        checkpointPeriods: checkpoints,
      });

      const hasAnySessions = data.sessions.some(
        (s) => s.sessionDate === col.date && (deptFilter === 'ALL' || s.department === deptFilter),
      );

      for (const ev of dayEvaluations) {
        const entry = rowMap.get(ev.student.id);
        if (!entry) continue;

        if (ev.fullDayStatus === 'HOLIDAY') {
          entry.dailyMarks[col.date] = 'H';
        } else if (ev.fullDayStatus === 'FULL_DAY_PRESENT') {
          entry.dailyMarks[col.date] = 'P';
          entry.totalWorkingDays += 1;
          entry.fullDaysPresent += 1;
        } else if (ev.fullDayStatus === 'FULL_DAY_ABSENT') {
          entry.dailyMarks[col.date] = 'A';
          entry.totalWorkingDays += 1;
          entry.fullDaysAbsent += 1;
        } else {
          entry.dailyMarks[col.date] = hasAnySessions ? 'Pending' : '—';
        }
      }
    }

    const exportRows = Array.from(rowMap.values()).map((r) => ({
      ...r,
      attendancePercent:
        r.totalWorkingDays > 0 ? (r.fullDaysPresent / r.totalWorkingDays) * 100 : 0,
    }));

    exportMonthlyAttendanceWorkbook(
      deptFilter === 'ALL' ? data.settings.institutionCode : deptFilter,
      monthKey,
      dayColumns,
      exportRows,
    );
  };

  const handleGenerateAiAdvisory = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await SmartAttendService.generateAiInsights({
        scope,
        departmentFilter: deptFilter,
        thresholdPercent: data.settings.lowAttendanceThreshold,
        totalEvaluatedStudents: reportRows.length,
        averageAttendancePercent: Number(avgAttendance.toFixed(1)),
        lowAttendanceAlertCount: lowAttendanceRows.length,
        lowAttendanceTopSample: lowAttendanceRows.slice(0, 8),
      });
      setAiInsights(res.insights);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Unable to generate Gemini API attendance insights.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
            {scope === 'SUBJECT'
              ? 'Subject-Wise Excel Reports'
              : scope === 'MONTHLY'
                ? 'Monthly Attendance Excel Reports'
                : 'Attendance Reports & Low-Attendance Alerts'}
          </h2>
          <p className="text-xs text-slate-600">
            Generate authentic Excel workbooks (`Subject.xlsx` and `Monthly P/A` sheets), CSV, and
            PDF compliance exports directly from stored records.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportSubjectExcel}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Subject (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportMonthlyExcel}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#172B2A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10201F]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Monthly P/A (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportAttendanceCsv(`smartattend_${scope.toLowerCase()}_report`, reportRows)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportAttendanceExcel(
                `smartattend_${scope.toLowerCase()}_summary`,
                `${scope} Summary`,
                reportRows,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Summary .xlsx</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportAttendancePdf(
                `smartattend_${scope.toLowerCase()}_report`,
                `${scope} Scope · Dept ${deptFilter}`,
                `Threshold: ${data.settings.lowAttendanceThreshold}%`,
                reportRows,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981]"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Report Controls */}
      <div className="grid gap-3 rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as ReportScope)}
          className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
        >
          <option value="SUBJECT">Subject-wise Report</option>
          <option value="MONTHLY">Monthly Report</option>
          <option value="DAILY">Daily Report</option>
          <option value="WEEKLY">Weekly Report (7 Days)</option>
          <option value="DEPARTMENT">Department-wise</option>
          <option value="YEAR">Year-wise</option>
          <option value="SECTION">Section-wise</option>
          <option value="STUDENT">Individual Student</option>
        </select>

        {isAdmin && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
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
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
        >
          <option value="ALL">All Years</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
        >
          <option value="ALL">All Sections</option>
          {SECTIONS.map((s) => (
            <option key={s} value={s}>
              Section {s}
            </option>
          ))}
        </select>

        {scope === 'MONTHLY' ? (
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
          />
        ) : scope === 'STUDENT' ? (
          <input
            type="text"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Filter student name / ID..."
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          />
        ) : (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">All Subjects</option>
            {data.subjects
              .filter((sub) => deptFilter === 'ALL' || sub.department === deptFilter)
              .map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subjectCode} · {sub.subjectName}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-600">Evaluated Students</span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#172B2A]">
            {reportRows.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs text-slate-600">Average Attendance Rate</span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#059669]">
            {avgAttendance.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
          <span className="text-xs text-amber-700">
            Low-Attendance Alerts (&lt;{data.settings.lowAttendanceThreshold}%)
          </span>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#172B2A]">
            {lowAttendanceRows.length}
          </p>
        </div>
      </div>

      {/* Optional Server-Side Gemini AI Advisory */}
      <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              <Sparkles className="h-4 w-4 text-[#059669]" aria-hidden="true" />
              <span>AI Attendance Risk Advisory (Gemini Server-Side)</span>
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Generates administrative insights from aggregated statistics only (never used for
              biometric identification).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateAiAdvisory()}
            disabled={aiLoading}
            className="rounded-lg border border-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#059669] hover:bg-[#10B981] hover:text-[#06281E] disabled:opacity-60"
          >
            {aiLoading ? 'Analyzing...' : 'Generate AI Insights'}
          </button>
        </div>
        {aiError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{aiError}</span>
          </div>
        )}
        {aiInsights && (
          <div className="mt-3 whitespace-pre-line rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-4 text-xs leading-relaxed text-[#0F1F1E]">
            {aiInsights}
          </div>
        )}
      </section>

      {/* Report Table */}
      <div className="overflow-x-auto rounded-xl border border-[#D1E7DC] bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D1E7DC] bg-[#F8FCF9] text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Register No</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Cohort</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Present</th>
              <th className="px-4 py-3 font-medium">Absent</th>
              <th className="px-4 py-3 font-medium">Rate %</th>
              <th className="px-4 py-3 font-medium">Standing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6F2EC]">
            {reportRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No student records found for this report filter.
                </td>
              </tr>
            ) : (
              reportRows.map((row) => {
                const isLow =
                  row.totalSessions > 0 &&
                  row.attendancePercent < data.settings.lowAttendanceThreshold;
                return (
                  <tr key={row.registerNo} className="hover:bg-[#F8FCF9]">
                    <td className="px-4 py-3 font-mono font-medium text-[#172B2A]">
                      {row.registerNo}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#172B2A]">{row.studentName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.department} · {row.academicYear} Sec {row.section}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.totalSessions}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.attendedSessions}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.absentSessions}</td>
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums text-[#059669]">
                      {row.totalSessions > 0 ? `${row.attendancePercent.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          isLow
                            ? 'border border-amber-200 bg-amber-50 text-amber-800'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {row.alertStatus}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
