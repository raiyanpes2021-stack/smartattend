import {
  AlertTriangle,
  Building2,
  Camera,
  Database,
  DoorOpen,
  FileSpreadsheet,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import type { WorkspaceBootstrapData } from '../../../types/smartattend';

interface OverviewViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  onNavigateTab: (tab: string) => void;
  onLoadSampleData?: () => Promise<void>;
  loadingSample?: boolean;
}

export function OverviewView({
  data,
  isAdmin,
  onNavigateTab,
  onLoadSampleData,
  loadingSample,
}: OverviewViewProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeStudents = data.students.filter((s) => s.enrollmentStatus === 'ACTIVE');
  const todayRecords = data.attendance.filter((a) => a.sessionDate === todayStr);
  const todayPresent = todayRecords.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
  ).length;
  const todayAbsent = todayRecords.filter((a) => a.status === 'ABSENT').length;
  const pendingVerifications = data.attendance.filter(
    (a) => a.status === 'PENDING_VERIFICATION',
  ).length;

  const finalizedCountable = data.attendance.filter(
    (a) => a.status !== 'PENDING_VERIFICATION' && a.status !== 'UNKNOWN',
  );
  const totalAttended = finalizedCountable.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
  ).length;
  const overallRate =
    finalizedCountable.length > 0
      ? (totalAttended / finalizedCountable.length) * 100
      : 0;

  const activeCameras = data.cameras.filter((c) => c.online).length;

  const kpis = isAdmin
    ? [
        { label: 'Total Students', value: activeStudents.length, icon: Users },
        { label: 'Departments', value: data.departments.length, icon: Building2 },
        { label: 'Active HODs', value: data.hods.filter((h) => h.active).length, icon: UserCheck },
        { label: 'Classrooms', value: data.classrooms.length, icon: DoorOpen },
        { label: 'Registered Cameras', value: data.cameras.length, icon: Camera },
        { label: "Today's Present", value: todayPresent, icon: UserCheck },
        { label: "Today's Absent", value: todayAbsent, icon: UserX },
        { label: 'Overall Attendance', value: `${overallRate.toFixed(1)}%`, icon: FileSpreadsheet },
      ]
    : [
        { label: 'Department Students', value: activeStudents.length, icon: Users },
        { label: 'Present Today', value: todayPresent, icon: UserCheck },
        { label: 'Absent Today', value: todayAbsent, icon: UserX },
        { label: 'Classrooms', value: data.classrooms.length, icon: DoorOpen },
        { label: 'Online Cameras', value: `${activeCameras}/${data.cameras.length}`, icon: Camera },
        { label: 'Dept Attendance', value: `${overallRate.toFixed(1)}%`, icon: FileSpreadsheet },
      ];

  const breakdownRows = isAdmin
    ? data.departments.map((dept) => {
        const deptStu = activeStudents.filter((s) => s.department === dept.code).length;
        const deptAtt = finalizedCountable.filter((a) => a.department === dept.code);
        const deptPres = deptAtt.filter(
          (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
        ).length;
        const rate = deptAtt.length > 0 ? (deptPres / deptAtt.length) * 100 : 0;
        return {
          key: dept.id,
          label: `${dept.code} · ${dept.name}`,
          students: deptStu,
          sessions: data.sessions.filter((s) => s.department === dept.code).length,
          rate,
        };
      })
    : (['1st Year', '2nd Year', '3rd Year', '4th Year'] as const).map((year) => {
        const yrStu = activeStudents.filter((s) => s.academicYear === year).length;
        const yrAtt = finalizedCountable.filter((a) => a.academicYear === year);
        const yrPres = yrAtt.filter(
          (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
        ).length;
        const rate = yrAtt.length > 0 ? (yrPres / yrAtt.length) * 100 : 0;
        return {
          key: year,
          label: year,
          students: yrStu,
          sessions: data.sessions.filter((s) => s.academicYear === year).length,
          rate,
        };
      });

  return (
    <div className="space-y-6">
      {data.students.length === 0 && (
        <section className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[#172B2A]">
                Database Initialized — Ready for Student Enrollment
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#475569]">
                No student records exist yet. Enroll real students in the Student Directory or{' '}
                {isAdmin
                  ? 'load the clearly labeled Sample Demonstration Dataset to inspect multi-department analytics.'
                  : 'ask Administration to import students or load sample demonstration records.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateTab('students')}
                className="rounded-lg border border-[#D1E7DC] bg-[#F0FDF4] px-3.5 py-2 text-xs font-semibold text-[#172B2A] transition-colors hover:border-[#10B981]"
              >
                Enroll Real Students
              </button>
              {isAdmin && onLoadSampleData && (
                <button
                  type="button"
                  onClick={() => void onLoadSampleData()}
                  disabled={loadingSample}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#059669] disabled:opacity-60"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{loadingSample ? 'Loading Sample Data...' : 'Load Sample Demo Data'}</span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {pendingVerifications > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              <strong className="font-mono tabular-nums">{pendingVerifications}</strong> recognition
              record(s) are marked <strong>Pending Verification</strong> and require manual approval.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('attendance')}
            className="rounded-lg border border-amber-400 bg-white px-3 py-1 font-semibold text-amber-900 transition-colors hover:bg-amber-100"
          >
            Review Attendance Queue
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#475569]">{card.label}</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#10B981]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-[#172B2A]">
                {card.value}
              </p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#E2EFE8] pb-3">
            <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
              {isAdmin ? 'Department Attendance Overview' : 'Academic Year Attendance Overview'}
            </h2>
            <span className="rounded bg-[#ECFDF5] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#065F46]">
              Threshold: {data.settings.lowAttendanceThreshold}%
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {breakdownRows.map((row) => (
              <div key={row.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#172B2A]">{row.label}</span>
                  <span className="font-mono tabular-nums text-[#475569]">
                    {row.students} students · {row.sessions} sessions ·{' '}
                    <strong className="text-[#059669]">{row.rate.toFixed(1)}%</strong>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E6F4ED]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      row.rate > 0 && row.rate < data.settings.lowAttendanceThreshold
                        ? 'bg-amber-500'
                        : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, row.rate))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#E2EFE8] pb-3">
            <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
              Recent Audit Trail
            </h2>
            <span className="font-mono text-[11px] text-[#475569]">
              {data.auditLogs.length} entries
            </span>
          </div>
          <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {data.auditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#64748B]">No audit events recorded yet.</p>
            ) : (
              data.auditLogs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-[#E2EFE8] bg-[#F8FCF9] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#059669]">
                      {log.action}
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-[#172B2A]">{log.details}</p>
                  <p className="mt-1 text-[10px] text-[#64748B]">
                    {log.actorName} ({log.actorRole})
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
