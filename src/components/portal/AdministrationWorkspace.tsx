import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarClock,
  Camera,
  ClipboardCheck,
  DoorOpen,
  FileBarChart2,
  LayoutDashboard,
  Settings,
  UserCog,
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
import { AnalyticsView } from './views/AnalyticsView';
import { AttendanceView } from './views/AttendanceView';
import { CamerasView } from './views/CamerasView';
import { ClassroomsView } from './views/ClassroomsView';
import { DepartmentsView } from './views/DepartmentsView';
import { FullDayAttendanceView } from './views/FullDayAttendanceView';
import { HodManagementView } from './views/HodManagementView';
import { LiveMonitoringView } from './views/LiveMonitoringView';
import { OverviewView } from './views/OverviewView';
import { ReportsView } from './views/ReportsView';
import { SettingsAndProfileView } from './views/SettingsAndProfileView';
import { StudentsView } from './views/StudentsView';
import { TimetableView } from './views/TimetableView';

interface AdministrationWorkspaceProps {
  user: AuthUser;
  onLogout: () => void;
}

type AdminTabId =
  | 'overview'
  | 'departments'
  | 'hods'
  | 'students'
  | 'classrooms'
  | 'cameras'
  | 'live'
  | 'timetable'
  | 'attendance'
  | 'fullday-attendance'
  | 'reports'
  | 'analytics'
  | 'settings';

export function AdministrationWorkspace({
  user,
  onLogout,
}: AdministrationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [data, setData] = useState<WorkspaceBootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
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
        const bootstrap = await SmartAttendService.getBootstrap();
        setData(bootstrap);
      } catch (err) {
        if (err instanceof AuthApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(
          err instanceof Error ? err.message : 'Unable to load Administration workspace.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onLogout],
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

  const handleLoadSampleData = async () => {
    setLoadingSample(true);
    try {
      const updated = await SmartAttendService.loadSampleData();
      setData(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample data.');
    } finally {
      setLoadingSample(false);
    }
  };

  const pendingCount =
    data?.attendance.filter((a) => a.status === 'PENDING_VERIFICATION').length ?? 0;

  const navItems: PortalNavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'departments', label: 'Departments', icon: <Building2 className="h-4 w-4" /> },
    { id: 'hods', label: 'HOD Management', icon: <UserCog className="h-4 w-4" /> },
    { id: 'students', label: 'Student Database', icon: <Users className="h-4 w-4" /> },
    { id: 'classrooms', label: 'Classroom Management', icon: <DoorOpen className="h-4 w-4" /> },
    { id: 'cameras', label: 'Camera Management', icon: <Camera className="h-4 w-4" /> },
    { id: 'live', label: 'Live Monitoring', icon: <Activity className="h-4 w-4" /> },
    { id: 'timetable', label: 'Timetable', icon: <CalendarClock className="h-4 w-4" /> },
    {
      id: 'attendance',
      label: 'Period Attendance',
      icon: <ClipboardCheck className="h-4 w-4" />,
      badge: pendingCount,
    },
    {
      id: 'fullday-attendance',
      label: 'Full-Day Attendance',
      icon: <CalendarCheck2 className="h-4 w-4" />,
    },
    { id: 'reports', label: 'Reports', icon: <FileBarChart2 className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <PortalShell
      user={user}
      portalSubtitle="Administration Portal"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as AdminTabId)}
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
          Loading SMARTATTEND Administration Portal...
        </div>
      ) : data ? (
        <ErrorBoundary onReset={() => void loadWorkspace(true)}>
          {activeTab === 'overview' && (
            <OverviewView
              data={data}
              isAdmin
              onNavigateTab={(t) => setActiveTab(t as AdminTabId)}
              onLoadSampleData={handleLoadSampleData}
              loadingSample={loadingSample}
            />
          )}
          {activeTab === 'departments' && (
            <DepartmentsView data={data} onDataChanged={() => loadWorkspace(true)} />
          )}
          {activeTab === 'hods' && (
            <HodManagementView data={data} onDataChanged={() => loadWorkspace(true)} />
          )}
          {activeTab === 'students' && (
            <StudentsView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
          {activeTab === 'classrooms' && (
            <ClassroomsView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
              onOpenLiveMonitoring={() => setActiveTab('live')}
            />
          )}
          {activeTab === 'cameras' && (
            <CamerasView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
          {activeTab === 'live' && (
            <LiveMonitoringView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
          {activeTab === 'timetable' && (
            <TimetableView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
          {activeTab === 'attendance' && (
            <AttendanceView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
          {activeTab === 'fullday-attendance' && (
            <FullDayAttendanceView
              data={data}
              isAdmin
              onDataChanged={() => loadWorkspace(true)}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsView key="admin-reports" data={data} isAdmin />
          )}
          {activeTab === 'analytics' && <AnalyticsView data={data} isAdmin />}
          {activeTab === 'settings' && (
            <SettingsAndProfileView
              data={data}
              isAdmin
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
          <p>Unable to load Administration dashboard data.</p>
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
