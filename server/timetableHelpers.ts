import type { DepartmentCode } from '../src/types/auth.ts';
import type {
  AcademicYear,
  CameraRecord,
  ClassroomRecord,
  DayOfWeek,
  InstitutionSettings,
  SectionCode,
  SubjectRecord,
  TimetablePeriodRecord,
} from '../src/types/smartattend.ts';

const TEACHING_DAYS: readonly DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface TimeSlotTemplate {
  periodNumber: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

const DEFAULT_DAILY_SLOTS: readonly TimeSlotTemplate[] = [
  { periodNumber: 1, periodLabel: 'Period 1', startTime: '09:00', endTime: '09:50', isBreak: false },
  { periodNumber: 2, periodLabel: 'Period 2', startTime: '09:50', endTime: '10:40', isBreak: false },
  { periodNumber: 0, periodLabel: 'Morning Break', startTime: '10:40', endTime: '10:55', isBreak: true },
  { periodNumber: 3, periodLabel: 'Period 3', startTime: '10:55', endTime: '11:45', isBreak: false },
  { periodNumber: 4, periodLabel: 'Period 4', startTime: '11:45', endTime: '12:35', isBreak: false },
  { periodNumber: 0, periodLabel: 'Lunch Break', startTime: '12:35', endTime: '13:20', isBreak: true },
  { periodNumber: 5, periodLabel: 'Period 5', startTime: '13:20', endTime: '14:10', isBreak: false },
  { periodNumber: 6, periodLabel: 'Period 6', startTime: '14:10', endTime: '15:00', isBreak: false },
  { periodNumber: 7, periodLabel: 'Period 7', startTime: '15:00', endTime: '15:50', isBreak: false },
];

export function buildDefaultTimetablePeriods(
  classrooms: ClassroomRecord[],
  subjects: SubjectRecord[],
): TimetablePeriodRecord[] {
  const now = new Date().toISOString();
  const periods: TimetablePeriodRecord[] = [];

  for (const room of classrooms) {
    const deptSubs = subjects.filter(
      (s) => s.department === room.department && s.academicYear === room.academicYear,
    );
    const fallbackSubs = subjects.filter((s) => s.department === room.department);
    const pool = deptSubs.length > 0 ? deptSubs : fallbackSubs;
    if (pool.length === 0) continue;

    for (let dayIdx = 0; dayIdx < TEACHING_DAYS.length; dayIdx++) {
      const dayOfWeek = TEACHING_DAYS[dayIdx];
      let subCursor = dayIdx;
      for (let sIdx = 0; sIdx < DEFAULT_DAILY_SLOTS.length; sIdx++) {
        const slot = DEFAULT_DAILY_SLOTS[sIdx];
        if (slot.isBreak) {
          periods.push({
            id: `tt-${room.id}-${dayOfWeek.toLowerCase()}-brk-${sIdx}`,
            department: room.department,
            academicYear: room.academicYear,
            section: room.section,
            dayOfWeek,
            periodNumber: 0,
            periodLabel: slot.periodLabel,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectId: null,
            subjectCode: 'BREAK',
            subjectName: slot.periodLabel,
            facultyName: '—',
            classroomId: room.id,
            isBreak: true,
            status: 'ACTIVE',
            updatedAt: now,
          });
          continue;
        }

        const chosenSub = pool[subCursor % pool.length];
        subCursor += 1;
        periods.push({
          id: `tt-${room.id}-${dayOfWeek.toLowerCase()}-p${slot.periodNumber}`,
          department: room.department,
          academicYear: room.academicYear,
          section: room.section,
          dayOfWeek,
          periodNumber: slot.periodNumber,
          periodLabel: slot.periodLabel,
          startTime: slot.startTime,
          endTime: slot.endTime,
          subjectId: chosenSub.id,
          subjectCode: chosenSub.subjectCode,
          subjectName: chosenSub.subjectName,
          facultyName: chosenSub.facultyName,
          classroomId: room.id,
          isBreak: false,
          status: 'ACTIVE',
          updatedAt: now,
        });
      }
    }
  }

  return periods;
}

export function hydrateCameraRecord(
  cam: Partial<CameraRecord> & { id: string; department: DepartmentCode },
  index: number,
  classrooms: ClassroomRecord[],
): CameraRecord {
  const room = classrooms.find((r) => r.id === cam.classroomId);
  const cameraNumber =
    cam.cameraNumber || `CAMERA ${String(index + 1).padStart(2, '0')}`;
  const academicYear: AcademicYear | 'COMMON' =
    cam.academicYear ?? room?.academicYear ?? '2nd Year';
  const section: SectionCode | 'COMMON' =
    cam.section ?? room?.section ?? 'A';
  const isSharedLab = Boolean(cam.isSharedLab);
  const authorizedDepartments =
    Array.isArray(cam.authorizedDepartments) && cam.authorizedDepartments.length > 0
      ? cam.authorizedDepartments
      : [cam.department];

  return {
    id: cam.id,
    cameraCode: cam.cameraCode || `CAM-${cam.department}-${index + 1}`,
    cameraNumber,
    name: cam.name || `${cam.department} Classroom Camera`,
    classroomId: cam.classroomId ?? null,
    department: cam.department,
    academicYear,
    section,
    isSharedLab,
    authorizedDepartments,
    sourceType: cam.sourceType ?? 'WEBCAM',
    connectionLabel: cam.connectionLabel ?? 'Local Browser MediaStream (getUserMedia)',
    gatewayUrl: cam.gatewayUrl ?? '',
    online: typeof cam.online === 'boolean' ? cam.online : true,
    monitoringActive: Boolean(cam.monitoringActive),
    lastError: cam.lastError ?? null,
    lastHeartbeatAt: cam.lastHeartbeatAt ?? null,
    createdAt: cam.createdAt ?? new Date().toISOString(),
    updatedAt: cam.updatedAt ?? new Date().toISOString(),
  };
}

export function hydrateInstitutionSettings(
  settings: Partial<InstitutionSettings>,
): InstitutionSettings {
  return {
    institutionName:
      settings.institutionName || 'SMARTATTEND Institute of Engineering & Technology',
    institutionCode: settings.institutionCode || 'SAIET-01',
    institutionTimezone: settings.institutionTimezone || 'Asia/Kolkata',
    lowAttendanceThreshold: settings.lowAttendanceThreshold ?? 75,
    highConfidenceThreshold: settings.highConfidenceThreshold ?? 0.58,
    pendingConfidenceThreshold: settings.pendingConfidenceThreshold ?? 0.44,
    biometricRetentionDays: settings.biometricRetentionDays ?? 365,
    biometricPolicyVersion: settings.biometricPolicyVersion || 'v2.1',
    allowManualFallback:
      typeof settings.allowManualFallback === 'boolean' ? settings.allowManualFallback : true,
    fullDayCheckpointPeriods:
      Array.isArray(settings.fullDayCheckpointPeriods) &&
      settings.fullDayCheckpointPeriods.length > 0
        ? settings.fullDayCheckpointPeriods
        : [1, 4, 7],
    totalPeriodsPerDay: settings.totalPeriodsPerDay ?? 7,
    sampleDataSeeded: Boolean(settings.sampleDataSeeded),
    updatedAt: settings.updatedAt || new Date().toISOString(),
  };
}
