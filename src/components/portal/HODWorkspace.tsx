import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  Camera,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import {
  auth,
  getFirebaseConnectionStatus,
  testConnection,
  type FirebaseConnectionStatus,
} from '../../firebase';
import { AuthApiError } from '../../services/AuthenticationService';
import { SmartAttendService } from '../../services/SmartAttendService';
import type { AuthUser } from '../../types/auth';
import type { WorkspaceBootstrapData } from '../../types/smartattend';
import { ErrorBoundary } from './ErrorBoundary';
import { PortalShell, type PortalNavItem } from './PortalShell';
import { AcademicYearsView } from './views/AcademicYearsView';
import { AnalyticsView } from './views/AnalyticsView';
import { AttendanceView } from './views/AttendanceView';
import { ClassroomsView } from './views/ClassroomsView';
import { FullDayAttendanceView } from './views/FullDayAttendanceView';
import { LiveMonitoringView } from './views/LiveMonitoringView';
import { OverviewView } from './views/OverviewView';
import { ReportsView } from './views/ReportsView';
import { SettingsAndProfileView } from './views/SettingsAndProfileView';
import { StudentsView } from './views/StudentsView';
import { TimetableView } from './views/TimetableView';

interface HODWorkspaceProps {
  user: AuthUser;
  onLogout: () => void;
}

type HodTabId =
  | 'overview'
  | 'cameras-live'
  | 'timetable'
  | 'students'
  | 'period-attendance'
  | 'subject-reports'
  | 'fullday-attendance'
  | 'monthly-reports'
  | 'analytics'
  | 'settings';

export function HODWorkspace({ user, onLogout }: HODWorkspaceProps) {
  const department = user.department ?? 'CSE';
  // Default landing tab for HOD: Classroom & Live Cameras
  const [activeTab, setActiveTab] = useState<HodTabId>('cameras-live');
  const [cameraSubTab, setCameraSubTab] = useState<'live' | 'classrooms'>('live');
  const [timetableSubTab, setTimetableSubTab] = useState<'schedule' | 'curriculum'>('schedule');
  const [data, setData] = useState<WorkspaceBootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseConnectionStatus>(
    getFirebaseConnectionStatus,
  );
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(
    auth.currentUser?.email ?? null,
  );

  const loadWorkspace = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const bootstrap = await SmartAttendService.getBootstrap(department);
        setData(bootstrap);
      } catch (err) {
        if (err instanceof AuthApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : `Unable to load ${department} department workspace.`,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [department, onLogout],
  );

  const recheckFirestore = useCallback(async () => {
    const status = await testConnection();
    setFirebaseStatus(status);
  }, []);

  useEffect(() => {
    void loadWorkspace(false);
    void recheckFirestore();
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUserEmail(fbUser?.email ?? fbUser?.uid ?? null);
    });
    return () => unsub();
  }, [loadWorkspace, recheckFirestore]);

  const handleNavigateTab = (target: string) => {
    if (target === 'attendance') {
      setActiveTab('period-attendance');
      return;
    }
    if (target === 'live' || target === 'cameras') {
      setActiveTab('cameras-live');
      setCameraSubTab('live');
      return;
    }
    if (target === 'classrooms') {
      setActiveTab('cameras-live');
      setCameraSubTab('classrooms');
      return;
    }
    if (target === 'years') {
      setActiveTab('timetable');
      setTimetableSubTab('curriculum');
      return;
    }
    setActiveTab(target as HodTabId);
  };

  const pendingCount =
    data?.attendance.filter((a) => a.status === 'PENDING_VERIFICATION').length ?? 0;

  const navItems: PortalNavItem[] = [
    {
      id: 'overview',
      label: 'Dashboard Overview',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'cameras-live',
      label: 'Classroom & Live Cameras',
      icon: <Camera className="h-4 w-4" />,
    },
    {
      id: 'timetable',
      label: 'Timetable Management',
      icon: <CalendarClock className="h-4 w-4" />,
    },
    {
      id: 'students',
      label: 'Student Management',
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: 'period-attendance',
      label: 'Period-wise Attendance',
      icon: <ClipboardCheck className="h-4 w-4" />,
      badge: pendingCount,
    },
    {
      id: 'subject-reports',
      label: 'Subject-wise Reports',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'fullday-attendance',
      label: 'Full-day Attendance',
      icon: <CalendarCheck2 className="h-4 w-4" />,
    },
    {
      id: 'monthly-reports',
      label: 'Monthly Excel Reports',
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <PortalShell
      user={user}
      portalSubtitle={`HOD Portal · ${department}`}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as HodTabId)}
      onLogout={onLogout}
      onRefresh={() => void loadWorkspace(true)}
      refreshing={refreshing}
      firebaseStatus={firebaseStatus}
      firebaseUserEmail={firebaseUserEmail}
    >
      {error && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadWorkspace(true)}
            className="rounded-lg border border-amber-400 bg-white px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-8 text-center text-xs font-medium text-[#475569] shadow-xs">
          Loading {department} Department Workspace...
        </div>
      ) : data ? (
        <ErrorBoundary onReset={() => void loadWorkspace(true)}>
          {activeTab === 'overview' && (
            <OverviewView
              data={data}
              isAdmin={false}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'cameras-live' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D1E7DC] bg-white px-4 py-3 shadow-xs">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                    {department} Classroom &amp; Live Camera Operations
                  </h2>
                  <p className="text-[11px] text-[#475569]">
                    Monitor active camera feeds with MediaPipe face detection or configure department classrooms.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-[#D1E7DC] bg-[#F0FDF4] p-1">
                  <button
                    type="button"
                    onClick={() => setCameraSubTab('live')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      cameraSubTab === 'live'
                        ? 'bg-[#172B2A] text-white'
                        : 'text-[#475569] hover:text-[#172B2A]'
                    }`}
                  >
                    Live Camera Monitoring
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraSubTab('classrooms')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      cameraSubTab === 'classrooms'
                        ? 'bg-[#172B2A] text-white'
                        : 'text-[#475569] hover:text-[#172B2A]'
                    }`}
                  >
                    Classroom Directory ({data.classrooms.length})
                  </button>
                </div>
              </div>

              {cameraSubTab === 'live' ? (
                <LiveMonitoringView
                  data={data}
                  isAdmin={false}
                  lockedDepartment={department}
                  onDataChanged={() => loadWorkspace(true)}
                />
              ) : (
                <ClassroomsView
                  data={data}
                  isAdmin={false}
                  lockedDepartment={department}
                  onDataChanged={() => loadWorkspace(true)}
                  onOpenLiveMonitoring={() => setCameraSubTab('live')}
                />
              )}
            </div>
          )}

          {activeTab === 'timetable' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D1E7DC] bg-white px-4 py-3 shadow-xs">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                    {department} Timetable, Holidays &amp; Curriculum
                  </h2>
                  <p className="text-[11px] text-[#475569]">
                    Manage weekly periods, substitutions, holidays, or add academic subjects per year.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-[#D1E7DC] bg-[#F0FDF4] p-1">
                  <button
                    type="button"
                    onClick={() => setTimetableSubTab('schedule')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      timetableSubTab === 'schedule'
                        ? 'bg-[#172B2A] text-white'
                        : 'text-[#475569] hover:text-[#172B2A]'
                    }`}
                  >
                    Weekly Schedule &amp; Overrides
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimetableSubTab('curriculum')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      timetableSubTab === 'curriculum'
                        ? 'bg-[#172B2A] text-white'
                        : 'text-[#475569] hover:text-[#172B2A]'
                    }`}
                  >
                    Academic Years &amp; Subjects ({data.subjects.length})
                  </button>
                </div>
              </div>

              {timetableSubTab === 'schedule' ? (
                <TimetableView
                  data={data}
                  isAdmin={false}
                  lockedDepartment={department}
                  onDataChanged={() => loadWorkspace(true)}
                />
              ) : (
                <AcademicYearsView
                  data={data}
                  department={department}
                  onDataChanged={() => loadWorkspace(true)}
                />
              )}
            </div>
          )}

          {activeTab === 'students' && (
            <StudentsView
              data={data}
              isAdmin={false}
              lockedDepartment={department}
              onDataChanged={() => loadWorkspace(true)}
            />
          )}

          {activeTab === 'period-attendance' && (
            <AttendanceView
              data={data}
              isAdmin={false}
              lockedDepartment={department}
              onDataChanged={() => loadWorkspace(true)}
            />
          )}

          {activeTab === 'subject-reports' && (
            <ReportsView
              key="hod-subject-reports"
              data={data}
              isAdmin={false}
              lockedDepartment={department}
              defaultScope="SUBJECT"
            />
          )}

          {activeTab === 'fullday-attendance' && (
            <FullDayAttendanceView
              data={data}
              isAdmin={false}
              lockedDepartment={department}
              onDataChanged={() => loadWorkspace(true)}
            />
          )}

          {activeTab === 'monthly-reports' && (
            <ReportsView
              key="hod-monthly-reports"
              data={data}
              isAdmin={false}
              lockedDepartment={department}
              defaultScope="MONTHLY"
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              data={data}
              isAdmin={false}
              lockedDepartment={department}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsAndProfileView
              data={data}
              isAdmin={false}
              firebaseStatus={firebaseStatus}
              firebaseUserEmail={firebaseUserEmail}
              onFirebaseAuthChanged={setFirebaseUserEmail}
              onRecheckFirebase={recheckFirestore}
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
        </ErrorBoundary>
      ) : (
        <div className="rounded-xl border border-[#D1E7DC] bg-white p-8 text-center text-xs text-[#475569] shadow-xs">
          <p>Unable to load {department} department dashboard data.</p>
          <button
            type="button"
            onClick={() => void loadWorkspace(false)}
            className="mt-3 rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white hover:bg-[#059669]"
          >
            Reload Dashboard
          </button>
        </div>
      )}
    </PortalShell>
  );
}
