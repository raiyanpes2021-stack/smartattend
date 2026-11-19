import type { AuthUser, DepartmentCode } from './auth';

export type AcademicYear = '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
export type SectionCode = 'A' | 'B' | 'C';

export const ACADEMIC_YEARS: readonly AcademicYear[] = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
];

export const SECTIONS: readonly SectionCode[] = ['A', 'B', 'C'];

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export type StudentEnrollmentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED';
export type FaceEnrollmentStatus = 'NOT_ENROLLED' | 'ENROLLED' | 'REVOKED';
export type ClassroomStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type CameraSourceType = 'WEBCAM' | 'DEMO_VIDEO' | 'RTSP_GATEWAY';
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'FINALIZED';
export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'PENDING_VERIFICATION'
  | 'EXCUSED'
  | 'UNKNOWN'
  | 'MANUALLY_CORRECTED';
export type AttendanceSource = 'AI_VISION' | 'MANUAL' | 'HOD_CORRECTION';
export type LivenessStatus = 'VERIFIED' | 'STATIC_WARNING' | 'UNCHECKED';
export type RecognitionOutcome =
  | 'MATCHED_PRESENT'
  | 'PENDING_VERIFICATION'
  | 'UNKNOWN'
  | 'LIVENESS_WARNING';

export interface InstitutionSettings {
  institutionName: string;
  institutionCode: string;
  institutionTimezone: string;
  lowAttendanceThreshold: number;
  highConfidenceThreshold: number;
  pendingConfidenceThreshold: number;
  biometricRetentionDays: number;
  biometricPolicyVersion: string;
  allowManualFallback: boolean;
  fullDayCheckpointPeriods: number[];
  totalPeriodsPerDay: number;
  sampleDataSeeded: boolean;
  updatedAt: string;
}

export interface DepartmentRecord {
  id: string;
  code: DepartmentCode;
  name: string;
  description: string;
  hodId: string | null;
  hodName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRecord {
  id: string;
  admissionNo?: string;
  registerNo: string;
  rollNo: string;
  fullName: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  email: string;
  phone: string;
  photoDataUrl: string | null;
  enrollmentStatus: StudentEnrollmentStatus;
  biometricConsentGranted: boolean;
  biometricConsentAt: string | null;
  biometricRevokedAt: string | null;
  faceEnrollmentStatus: FaceEnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FaceEnrollmentRecord {
  id: string;
  studentId: string;
  department: DepartmentCode;
  consentGranted: boolean;
  consentTimestamp: string;
  policyVersion: string;
  descriptor: number[];
  status: 'ACTIVE' | 'REVOKED';
  updatedBy: string;
  updatedAt: string;
}

export interface ClassroomRecord {
  id: string;
  roomCode: string;
  roomName: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  floor: string;
  building: string;
  capacity: number;
  assignedCameraId: string | null;
  status: ClassroomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CameraRecord {
  id: string;
  cameraCode: string;
  cameraNumber: string;
  name: string;
  classroomId: string | null;
  department: DepartmentCode;
  academicYear: AcademicYear | 'COMMON';
  section: SectionCode | 'COMMON';
  isSharedLab: boolean;
  authorizedDepartments: DepartmentCode[];
  sourceType: CameraSourceType;
  connectionLabel: string;
  gatewayUrl: string;
  online: boolean;
  monitoringActive: boolean;
  lastError: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectRecord {
  id: string;
  subjectCode: string;
  subjectName: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  facultyName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimetablePeriodRecord {
  id: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  classroomId: string | null;
  isBreak: boolean;
  status: 'ACTIVE' | 'CANCELLED';
  updatedAt: string;
}

export interface TimetableHolidayRecord {
  id: string;
  date: string;
  title: string;
  department: DepartmentCode | 'ALL';
  type: 'HOLIDAY' | 'CANCELLED_DAY' | 'SPECIAL_EVENT';
  createdAt: string;
}

export interface TimetableOverrideRecord {
  id: string;
  date: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  periodNumber: number;
  overrideType: 'CANCELLED' | 'SUBSTITUTION';
  subjectId: string | null;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  classroomId: string | null;
  reason: string;
  updatedAt: string;
}

export interface ClassSessionRecord {
  id: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  classroomId: string;
  cameraId: string | null;
  subjectId: string;
  subjectName: string;
  facultyName: string;
  periodNumber: number;
  periodLabel: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  finalizedAt: string | null;
  finalizedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  registerNo: string;
  studentName: string;
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  subjectId: string;
  subjectName?: string;
  periodNumber: number;
  periodLabel: string;
  sessionDate: string;
  status: AttendanceStatus;
  verificationSource: AttendanceSource;
  verificationStatus?:
    | 'VERIFIED_AI'
    | 'PENDING_REVIEW'
    | 'MANUAL_VERIFIED'
    | 'MANUALLY_CORRECTED'
    | 'UNMARKED';
  confidence: number | null;
  livenessPassed: boolean | null;
  correctionReason: string | null;
  recognitionTimestamp?: string | null;
  markedAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface RecognitionEventRecord {
  id: string;
  sessionId: string;
  cameraId: string;
  department: DepartmentCode;
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  matchedRegisterNo: string | null;
  confidence: number;
  livenessStatus: LivenessStatus;
  outcome: RecognitionOutcome;
  capturedAt: string;
  reviewed: boolean;
  reviewedAction: string | null;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorRole: 'ADMINISTRATION' | 'HOD';
  actorName: string;
  department: DepartmentCode | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface WorkspaceBootstrapData {
  user: AuthUser;
  settings: InstitutionSettings;
  departments: DepartmentRecord[];
  hods: AuthUser[];
  students: StudentRecord[];
  faceEnrollments: FaceEnrollmentRecord[];
  classrooms: ClassroomRecord[];
  cameras: CameraRecord[];
  subjects: SubjectRecord[];
  timetablePeriods: TimetablePeriodRecord[];
  holidays: TimetableHolidayRecord[];
  timetableOverrides: TimetableOverrideRecord[];
  sessions: ClassSessionRecord[];
  attendance: AttendanceRecord[];
  recognitionEvents: RecognitionEventRecord[];
  auditLogs: AuditLogRecord[];
}
