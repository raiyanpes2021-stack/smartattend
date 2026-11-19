import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthUser, DepartmentCode } from '../src/types/auth.ts';
import type {
  AcademicYear,
  AttendanceRecord,
  AttendanceSource,
  AttendanceStatus,
  AuditLogRecord,
  CameraRecord,
  CameraSourceType,
  ClassroomRecord,
  ClassroomStatus,
  ClassSessionRecord,
  DayOfWeek,
  DepartmentRecord,
  FaceEnrollmentRecord,
  InstitutionSettings,
  LivenessStatus,
  RecognitionEventRecord,
  RecognitionOutcome,
  SectionCode,
  StudentEnrollmentStatus,
  StudentRecord,
  SubjectRecord,
  TimetableHolidayRecord,
  TimetableOverrideRecord,
  TimetablePeriodRecord,
  WorkspaceBootstrapData,
} from '../src/types/smartattend.ts';
import { resolveCurrentTimetableContext } from '../src/utils/timetableResolver.ts';
import { listHodAccounts } from './authStore.ts';
import {
  buildDefaultTimetablePeriods,
  hydrateCameraRecord,
  hydrateInstitutionSettings,
} from './timetableHelpers.ts';

interface SmartAttendDatabase {
  settings: InstitutionSettings;
  departments: DepartmentRecord[];
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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'smartattend-db.json');

const VALID_YEARS: readonly AcademicYear[] = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const VALID_SECTIONS: readonly SectionCode[] = ['A', 'B', 'C'];

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

function todayDateStr(offsetDays = 0): string {
  const dt = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 10);
}

function createInitialDatabase(): SmartAttendDatabase {
  const now = new Date().toISOString();
  const hods = listHodAccounts();
  const hodForDept = (code: string) => hods.find((h) => h.department === code) ?? null;

  const departments: DepartmentRecord[] = [
    {
      id: 'dept-cse',
      code: 'CSE',
      name: 'Computer Science and Engineering',
      description: 'Core algorithms, distributed systems, and software engineering laboratories.',
      hodId: hodForDept('CSE')?.id ?? null,
      hodName: hodForDept('CSE')?.fullName ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dept-it',
      code: 'IT',
      name: 'Information Technology',
      description: 'Enterprise networks, cloud infrastructure, and information security.',
      hodId: hodForDept('IT')?.id ?? null,
      hodName: hodForDept('IT')?.fullName ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dept-aiml',
      code: 'AIML',
      name: 'Artificial Intelligence & Machine Learning',
      description: 'Deep neural architectures, computer vision, and autonomous intelligence.',
      hodId: hodForDept('AIML')?.id ?? null,
      hodName: hodForDept('AIML')?.fullName ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dept-aids',
      code: 'AIDS',
      name: 'Artificial Intelligence & Data Science',
      description: 'Statistical inference, big data engineering, and decision systems.',
      hodId: hodForDept('AIDS')?.id ?? null,
      hodName: hodForDept('AIDS')?.fullName ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const rawCameras: CameraRecord[] = [
    {
      id: 'cam-cse-204',
      cameraCode: 'CAM-CSE-204',
      cameraNumber: 'CAMERA 01',
      name: 'CSE-204 Browser Webcam Feed',
      classroomId: 'cls-cse-204',
      department: 'CSE',
      academicYear: '2nd Year',
      section: 'A',
      isSharedLab: false,
      authorizedDepartments: ['CSE'],
      sourceType: 'WEBCAM',
      connectionLabel: 'Local Browser MediaStream (getUserMedia)',
      gatewayUrl: '',
      online: true,
      monitoringActive: false,
      lastError: null,
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cam-it-108',
      cameraCode: 'CAM-IT-108',
      cameraNumber: 'CAMERA 02',
      name: 'IT-108 Demo Video Feed',
      classroomId: 'cls-it-108',
      department: 'IT',
      academicYear: '1st Year',
      section: 'A',
      isSharedLab: false,
      authorizedDepartments: ['IT'],
      sourceType: 'DEMO_VIDEO',
      connectionLabel: 'Uploaded Demo Classroom Video Feed',
      gatewayUrl: '',
      online: true,
      monitoringActive: false,
      lastError: null,
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cam-aiml-202',
      cameraCode: 'CAM-AIML-202',
      cameraNumber: 'CAMERA 03',
      name: 'AIML-202 Browser Webcam Feed',
      classroomId: 'cls-aiml-202',
      department: 'AIML',
      academicYear: '2nd Year',
      section: 'A',
      isSharedLab: false,
      authorizedDepartments: ['AIML'],
      sourceType: 'WEBCAM',
      connectionLabel: 'Local Browser MediaStream (getUserMedia)',
      gatewayUrl: '',
      online: true,
      monitoringActive: false,
      lastError: null,
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cam-aids-104',
      cameraCode: 'CAM-AIDS-104',
      cameraNumber: 'CAMERA 04',
      name: 'AIDS-104 RTSP Gateway Node',
      classroomId: 'cls-aids-104',
      department: 'AIDS',
      academicYear: '1st Year',
      section: 'A',
      isSharedLab: false,
      authorizedDepartments: ['AIDS'],
      sourceType: 'RTSP_GATEWAY',
      connectionLabel: 'rtsp://campus-nvr.local:554/aids-104 (Requires WebRTC/HLS Gateway)',
      gatewayUrl: '',
      online: false,
      monitoringActive: false,
      lastError: 'Gateway bridge URL not configured; raw RTSP cannot stream directly in browser.',
      lastHeartbeatAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const cameras = rawCameras;

  const classrooms: ClassroomRecord[] = [
    {
      id: 'cls-cse-204',
      roomCode: 'CSE-204',
      roomName: 'Room 204 · Smart Computing Lab',
      department: 'CSE',
      academicYear: '2nd Year',
      section: 'A',
      floor: '2nd Floor',
      building: 'Turing Block',
      capacity: 64,
      assignedCameraId: 'cam-cse-204',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-cse-301',
      roomCode: 'CSE-301',
      roomName: 'Room 301 · Systems Lecture Hall',
      department: 'CSE',
      academicYear: '3rd Year',
      section: 'A',
      floor: '3rd Floor',
      building: 'Turing Block',
      capacity: 72,
      assignedCameraId: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-it-108',
      roomCode: 'IT-108',
      roomName: 'Room 108 · Network Architecture Studio',
      department: 'IT',
      academicYear: '1st Year',
      section: 'A',
      floor: '1st Floor',
      building: 'Shannon Wing',
      capacity: 60,
      assignedCameraId: 'cam-it-108',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-it-402',
      roomCode: 'IT-402',
      roomName: 'Room 402 · Enterprise Systems Seminar',
      department: 'IT',
      academicYear: '4th Year',
      section: 'B',
      floor: '4th Floor',
      building: 'Shannon Wing',
      capacity: 56,
      assignedCameraId: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-aiml-202',
      roomCode: 'AIML-202',
      roomName: 'Room 202 · Neural Vision Studio',
      department: 'AIML',
      academicYear: '2nd Year',
      section: 'A',
      floor: '2nd Floor',
      building: 'Ramanujan Centre',
      capacity: 60,
      assignedCameraId: 'cam-aiml-202',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-aiml-305',
      roomCode: 'AIML-305',
      roomName: 'Room 305 · Machine Intelligence Hall',
      department: 'AIML',
      academicYear: '3rd Year',
      section: 'A',
      floor: '3rd Floor',
      building: 'Ramanujan Centre',
      capacity: 68,
      assignedCameraId: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-aids-104',
      roomCode: 'AIDS-104',
      roomName: 'Room 104 · Statistical Modeling Hall',
      department: 'AIDS',
      academicYear: '1st Year',
      section: 'A',
      floor: '1st Floor',
      building: 'Ramanujan Centre',
      capacity: 64,
      assignedCameraId: 'cam-aids-104',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cls-aids-401',
      roomCode: 'AIDS-401',
      roomName: 'Room 401 · Data Engineering Capstone',
      department: 'AIDS',
      academicYear: '4th Year',
      section: 'A',
      floor: '4th Floor',
      building: 'Ramanujan Centre',
      capacity: 58,
      assignedCameraId: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const subjects: SubjectRecord[] = [
    {
      id: 'sub-cse-201',
      subjectCode: 'CS2201',
      subjectName: 'Design & Analysis of Algorithms',
      department: 'CSE',
      academicYear: '2nd Year',
      facultyName: 'Prof. Meenakshi Iyer',
      credits: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-cse-301',
      subjectCode: 'CS3302',
      subjectName: 'Distributed Systems Architecture',
      department: 'CSE',
      academicYear: '3rd Year',
      facultyName: 'Dr. Rameshwar Prasad',
      credits: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-it-101',
      subjectCode: 'IT1104',
      subjectName: 'Foundations of Computer Networks',
      department: 'IT',
      academicYear: '1st Year',
      facultyName: 'Prof. Vikramaditya Rao',
      credits: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-it-401',
      subjectCode: 'IT4401',
      subjectName: 'Cloud Security & Governance',
      department: 'IT',
      academicYear: '4th Year',
      facultyName: 'Dr. Ananya Deshmukh',
      credits: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-aiml-201',
      subjectCode: 'AL2203',
      subjectName: 'Computer Vision & Pattern Recognition',
      department: 'AIML',
      academicYear: '2nd Year',
      facultyName: 'Dr. Kavitha Subramanian',
      credits: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-aiml-301',
      subjectCode: 'AL3305',
      subjectName: 'Reinforcement & Deep Learning',
      department: 'AIML',
      academicYear: '3rd Year',
      facultyName: 'Prof. Karthik Krishnan',
      credits: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-aids-101',
      subjectCode: 'AD1102',
      subjectName: 'Probability & Statistical Inference',
      department: 'AIDS',
      academicYear: '1st Year',
      facultyName: 'Prof. Siddharth Kulkarni',
      credits: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-aids-401',
      subjectCode: 'AD4402',
      subjectName: 'Large-Scale Data Pipelines',
      department: 'AIDS',
      academicYear: '4th Year',
      facultyName: 'Dr. Niharika Sen',
      credits: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const timetablePeriods = buildDefaultTimetablePeriods(classrooms, subjects);

  return {
    settings: hydrateInstitutionSettings({
      institutionName: 'SMARTATTEND Institute of Engineering & Technology',
      institutionCode: 'SAIET-01',
      institutionTimezone: 'Asia/Kolkata',
      lowAttendanceThreshold: 75,
      highConfidenceThreshold: 0.58,
      pendingConfidenceThreshold: 0.44,
      biometricRetentionDays: 365,
      biometricPolicyVersion: 'v2.1',
      allowManualFallback: true,
      fullDayCheckpointPeriods: [1, 4, 7],
      totalPeriodsPerDay: 7,
      sampleDataSeeded: false,
      updatedAt: now,
    }),
    departments,
    students: [],
    faceEnrollments: [],
    classrooms,
    cameras,
    subjects,
    timetablePeriods,
    holidays: [],
    timetableOverrides: [],
    sessions: [],
    attendance: [],
    recognitionEvents: [],
    auditLogs: [
      {
        id: makeId('log'),
        actorId: 'SYSTEM',
        actorRole: 'ADMINISTRATION',
        actorName: 'SMARTATTEND Platform',
        department: null,
        action: 'SYSTEM_INITIALIZED',
        targetType: 'INSTITUTION',
        targetId: 'SAIET-01',
        details: 'Initialized 4 core engineering departments, classrooms, and subjects.',
        createdAt: now,
      },
    ],
  };
}

function writeDbAtomic(db: SmartAttendDatabase): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, DB_PATH);
}

function hydrateExistingDatabase(rawDb: SmartAttendDatabase): SmartAttendDatabase {
  const classrooms = Array.isArray(rawDb.classrooms) ? rawDb.classrooms : [];
  const subjects = Array.isArray(rawDb.subjects) ? rawDb.subjects : [];
  const cameras = Array.isArray(rawDb.cameras)
    ? rawDb.cameras.map((cam, idx) => hydrateCameraRecord(cam, idx, classrooms))
    : [];
  const timetablePeriods =
    Array.isArray(rawDb.timetablePeriods) && rawDb.timetablePeriods.length > 0
      ? rawDb.timetablePeriods
      : buildDefaultTimetablePeriods(classrooms, subjects);

  const sessions = Array.isArray(rawDb.sessions)
    ? rawDb.sessions.map((s) => ({
        ...s,
        periodNumber: typeof s.periodNumber === 'number' ? s.periodNumber : 1,
        periodLabel: s.periodLabel || 'Period 1',
      }))
    : [];

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const subjectMap = new Map(subjects.map((sub) => [sub.id, sub]));

  const attendance = Array.isArray(rawDb.attendance)
    ? rawDb.attendance.map((a) => {
        const sess = sessionMap.get(a.sessionId);
        const sub = subjectMap.get(a.subjectId);
        return {
          ...a,
          periodNumber:
            typeof a.periodNumber === 'number'
              ? a.periodNumber
              : (sess?.periodNumber ?? 1),
          periodLabel: a.periodLabel || sess?.periodLabel || 'Period 1',
          subjectName:
            a.subjectName ||
            sess?.subjectName ||
            (sub ? `${sub.subjectCode} · ${sub.subjectName}` : 'General Session'),
        };
      })
    : [];

  return {
    settings: hydrateInstitutionSettings(rawDb.settings || {}),
    departments: rawDb.departments || [],
    students: rawDb.students || [],
    faceEnrollments: rawDb.faceEnrollments || [],
    classrooms,
    cameras,
    subjects,
    timetablePeriods,
    holidays: Array.isArray(rawDb.holidays) ? rawDb.holidays : [],
    timetableOverrides: Array.isArray(rawDb.timetableOverrides)
      ? rawDb.timetableOverrides
      : [],
    sessions,
    attendance,
    recognitionEvents: rawDb.recognitionEvents || [],
    auditLogs: rawDb.auditLogs || [],
  };
}

function loadOrInitDb(): SmartAttendDatabase {
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as SmartAttendDatabase;
      if (parsed && parsed.settings && Array.isArray(parsed.departments)) {
        const hydrated = hydrateExistingDatabase(parsed);
        writeDbAtomic(hydrated);
        return hydrated;
      }
    } catch {
      // Fallback to fresh structure only if file is unreadable
    }
  }
  const initial = createInitialDatabase();
  writeDbAtomic(initial);
  return initial;
}

const dbState: SmartAttendDatabase = loadOrInitDb();

function recordAuditLog(params: {
  actor: AuthUser;
  department: DepartmentCode | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}): void {
  dbState.auditLogs.unshift({
    id: makeId('log'),
    actorId: params.actor.loginId,
    actorRole: params.actor.role,
    actorName: params.actor.fullName,
    department: params.department,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: new Date().toISOString(),
  });
  if (dbState.auditLogs.length > 500) {
    dbState.auditLogs.length = 500;
  }
}

export function getWorkspaceBootstrap(user: AuthUser): WorkspaceBootstrapData {
  const hods = listHodAccounts();
  if (user.role === 'ADMINISTRATION') {
    return {
      user,
      settings: dbState.settings,
      departments: dbState.departments,
      hods,
      students: dbState.students,
      faceEnrollments: dbState.faceEnrollments,
      classrooms: dbState.classrooms,
      cameras: dbState.cameras,
      subjects: dbState.subjects,
      timetablePeriods: dbState.timetablePeriods,
      holidays: dbState.holidays,
      timetableOverrides: dbState.timetableOverrides,
      sessions: dbState.sessions,
      attendance: dbState.attendance,
      recognitionEvents: dbState.recognitionEvents,
      auditLogs: dbState.auditLogs,
    };
  }

  const dept = user.department;
  return {
    user,
    settings: dbState.settings,
    departments: dbState.departments.filter((d) => d.code === dept),
    hods: hods.filter((h) => h.id === user.id),
    students: dbState.students.filter((s) => s.department === dept),
    faceEnrollments: dbState.faceEnrollments.filter((f) => f.department === dept),
    classrooms: dbState.classrooms.filter((c) => c.department === dept),
    cameras: dbState.cameras.filter(
      (c) =>
        c.department === dept ||
        (c.isSharedLab && dept !== null && c.authorizedDepartments.includes(dept)),
    ),
    subjects: dbState.subjects.filter((s) => s.department === dept),
    timetablePeriods: dbState.timetablePeriods.filter((t) => t.department === dept),
    holidays: dbState.holidays.filter(
      (h) => h.department === 'ALL' || h.department === dept,
    ),
    timetableOverrides: dbState.timetableOverrides.filter((o) => o.department === dept),
    sessions: dbState.sessions.filter((s) => s.department === dept),
    attendance: dbState.attendance.filter((a) => a.department === dept),
    recognitionEvents: dbState.recognitionEvents.filter((e) => e.department === dept),
    auditLogs: dbState.auditLogs.filter((l) => l.department === dept),
  };
}

export function syncDepartmentHodAssignment(hod: AuthUser): void {
  const now = new Date().toISOString();
  for (const dept of dbState.departments) {
    if (dept.hodId === hod.id && dept.code !== hod.department) {
      dept.hodId = null;
      dept.hodName = null;
      dept.updatedAt = now;
    }
    if (dept.code === hod.department) {
      dept.hodId = hod.id;
      dept.hodName = hod.fullName;
      dept.updatedAt = now;
    }
  }
  writeDbAtomic(dbState);
}

// Settings
export function updateInstitutionSettings(
  actor: AuthUser,
  patch: Partial<InstitutionSettings>,
): InstitutionSettings {
  const s = dbState.settings;
  if (typeof patch.institutionName === 'string' && patch.institutionName.trim().length >= 2) {
    s.institutionName = patch.institutionName.trim();
  }
  if (typeof patch.institutionCode === 'string' && patch.institutionCode.trim().length >= 2) {
    s.institutionCode = patch.institutionCode.trim().toUpperCase();
  }
  if (typeof patch.institutionTimezone === 'string' && patch.institutionTimezone.trim()) {
    s.institutionTimezone = patch.institutionTimezone.trim();
  }
  if (typeof patch.lowAttendanceThreshold === 'number' && patch.lowAttendanceThreshold >= 10 && patch.lowAttendanceThreshold <= 99) {
    s.lowAttendanceThreshold = Math.round(patch.lowAttendanceThreshold);
  }
  if (typeof patch.highConfidenceThreshold === 'number' && patch.highConfidenceThreshold >= 0.4 && patch.highConfidenceThreshold <= 0.99) {
    s.highConfidenceThreshold = Number(patch.highConfidenceThreshold.toFixed(2));
  }
  if (typeof patch.pendingConfidenceThreshold === 'number' && patch.pendingConfidenceThreshold >= 0.2 && patch.pendingConfidenceThreshold <= s.highConfidenceThreshold) {
    s.pendingConfidenceThreshold = Number(patch.pendingConfidenceThreshold.toFixed(2));
  }
  if (typeof patch.biometricRetentionDays === 'number' && patch.biometricRetentionDays >= 1 && patch.biometricRetentionDays <= 3650) {
    s.biometricRetentionDays = Math.round(patch.biometricRetentionDays);
  }
  if (typeof patch.biometricPolicyVersion === 'string' && patch.biometricPolicyVersion.trim()) {
    s.biometricPolicyVersion = patch.biometricPolicyVersion.trim();
  }
  if (typeof patch.allowManualFallback === 'boolean') {
    s.allowManualFallback = patch.allowManualFallback;
  }
  if (Array.isArray(patch.fullDayCheckpointPeriods)) {
    const clean = [...new Set(patch.fullDayCheckpointPeriods.map(Number))].filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= 12,
    ).sort((a, b) => a - b);
    if (clean.length > 0) s.fullDayCheckpointPeriods = clean;
  }
  if (typeof patch.totalPeriodsPerDay === 'number' && patch.totalPeriodsPerDay >= 1 && patch.totalPeriodsPerDay <= 12) {
    s.totalPeriodsPerDay = Math.round(patch.totalPeriodsPerDay);
  }
  s.updatedAt = new Date().toISOString();

  recordAuditLog({
    actor,
    department: actor.role === 'HOD' ? actor.department : null,
    action: 'SETTINGS_UPDATED',
    targetType: 'INSTITUTION',
    targetId: s.institutionCode,
    details: `Updated institutional thresholds (Low Attendance ${s.lowAttendanceThreshold}%, AI High ${Math.round(s.highConfidenceThreshold * 100)}%, Full-Day Checkpoints: P${s.fullDayCheckpointPeriods.join(', P')}).`,
  });
  writeDbAtomic(dbState);
  return s;
}

// Departments
export function upsertDepartment(
  actor: AuthUser,
  payload: { id?: string; code: string; name: string; description?: string; hodId?: string | null; active?: boolean },
): { ok: true; department: DepartmentRecord } | { ok: false; status: number; message: string } {
  const code = payload.code.trim().toUpperCase();
  const name = payload.name.trim();
  if (!/^[A-Z0-9_-]{2,16}$/.test(code) || name.length < 2) {
    return { ok: false, status: 400, message: 'Department code (2–16 uppercase chars) and full name are required.' };
  }

  const hods = listHodAccounts();
  const matchedHod = payload.hodId ? hods.find((h) => h.id === payload.hodId) ?? null : null;
  const now = new Date().toISOString();

  if (payload.id) {
    const existing = dbState.departments.find((d) => d.id === payload.id);
    if (!existing) {
      return { ok: false, status: 404, message: 'Department not found.' };
    }
    existing.name = name;
    existing.description = (payload.description ?? existing.description).trim();
    if (payload.hodId !== undefined) {
      existing.hodId = matchedHod?.id ?? null;
      existing.hodName = matchedHod?.fullName ?? null;
    }
    if (typeof payload.active === 'boolean') {
      existing.active = payload.active;
    }
    existing.updatedAt = now;
    recordAuditLog({
      actor,
      department: existing.code,
      action: 'DEPARTMENT_UPDATED',
      targetType: 'DEPARTMENT',
      targetId: existing.code,
      details: `Updated department ${existing.code} (${existing.name}).`,
    });
    writeDbAtomic(dbState);
    return { ok: true, department: existing };
  }

  if (dbState.departments.some((d) => d.code === code)) {
    return { ok: false, status: 409, message: `Department ${code} already exists.` };
  }

  const created: DepartmentRecord = {
    id: `dept-${code.toLowerCase()}`,
    code,
    name,
    description: (payload.description ?? '').trim(),
    hodId: matchedHod?.id ?? null,
    hodName: matchedHod?.fullName ?? null,
    active: payload.active !== false,
    createdAt: now,
    updatedAt: now,
  };
  dbState.departments.push(created);
  recordAuditLog({
    actor,
    department: created.code,
    action: 'DEPARTMENT_CREATED',
    targetType: 'DEPARTMENT',
    targetId: created.code,
    details: `Created department ${created.code} (${created.name}).`,
  });
  writeDbAtomic(dbState);
  return { ok: true, department: created };
}

// Students
export function createStudent(
  actor: AuthUser,
  payload: {
    admissionNo?: string;
    registerNo: string;
    rollNo: string;
    fullName: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    section: SectionCode;
    email: string;
    phone?: string;
    photoDataUrl?: string | null;
    enrollmentStatus?: StudentEnrollmentStatus;
  },
): { ok: true; student: StudentRecord } | { ok: false; status: number; message: string } {
  const registerNo = payload.registerNo.trim().toUpperCase();
  const admissionNo = (payload.admissionNo ?? payload.registerNo).trim().toUpperCase();
  const rollNo = payload.rollNo.trim().toUpperCase();
  const fullName = payload.fullName.trim();
  const department = payload.department.trim().toUpperCase();
  const email = payload.email.trim().toLowerCase();

  if (actor.role === 'HOD' && actor.department !== department) {
    return { ok: false, status: 403, message: `HOD accounts can only register students in ${actor.department}.` };
  }

  if (!registerNo || !rollNo || fullName.length < 2 || !email.includes('@')) {
    return { ok: false, status: 400, message: 'Register No, Roll No, full name, and valid email are required.' };
  }

  if (!VALID_YEARS.includes(payload.academicYear) || !VALID_SECTIONS.includes(payload.section)) {
    return { ok: false, status: 400, message: 'Valid Academic Year (1st–4th) and Section (A–C) are required.' };
  }

  if (dbState.students.some((s) => s.registerNo.toUpperCase() === registerNo)) {
    return { ok: false, status: 409, message: `Student with Register No ${registerNo} already exists.` };
  }

  const now = new Date().toISOString();
  const student: StudentRecord = {
    id: makeId('stu'),
    admissionNo,
    registerNo,
    rollNo,
    fullName,
    department,
    academicYear: payload.academicYear,
    section: payload.section,
    email,
    phone: (payload.phone ?? '').trim(),
    photoDataUrl: payload.photoDataUrl ?? null,
    enrollmentStatus: payload.enrollmentStatus ?? 'ACTIVE',
    biometricConsentGranted: false,
    biometricConsentAt: null,
    biometricRevokedAt: null,
    faceEnrollmentStatus: 'NOT_ENROLLED',
    createdAt: now,
    updatedAt: now,
  };

  dbState.students.push(student);
  recordAuditLog({
    actor,
    department: student.department,
    action: 'STUDENT_CREATED',
    targetType: 'STUDENT',
    targetId: student.registerNo,
    details: `Enrolled ${student.fullName} (${student.registerNo}) in ${student.department} ${student.academicYear} Sec ${student.section}.`,
  });
  writeDbAtomic(dbState);
  return { ok: true, student };
}

export function updateStudent(
  actor: AuthUser,
  id: string,
  patch: Partial<StudentRecord>,
): { ok: true; student: StudentRecord } | { ok: false; status: number; message: string } {
  const student = dbState.students.find((s) => s.id === id);
  if (!student) {
    return { ok: false, status: 404, message: 'Student not found.' };
  }
  if (actor.role === 'HOD' && actor.department !== student.department) {
    return { ok: false, status: 403, message: `Access denied: student belongs to ${student.department}.` };
  }

  if (typeof patch.admissionNo === 'string' && patch.admissionNo.trim()) {
    student.admissionNo = patch.admissionNo.trim().toUpperCase();
  }
  if (typeof patch.fullName === 'string' && patch.fullName.trim().length >= 2) {
    student.fullName = patch.fullName.trim();
  }
  if (typeof patch.rollNo === 'string' && patch.rollNo.trim()) {
    student.rollNo = patch.rollNo.trim().toUpperCase();
  }
  if (typeof patch.email === 'string' && patch.email.includes('@')) {
    student.email = patch.email.trim().toLowerCase();
  }
  if (typeof patch.phone === 'string') {
    student.phone = patch.phone.trim();
  }
  if (patch.department && actor.role === 'ADMINISTRATION') {
    student.department = patch.department.trim().toUpperCase();
  }
  if (patch.academicYear && VALID_YEARS.includes(patch.academicYear)) {
    student.academicYear = patch.academicYear;
  }
  if (patch.section && VALID_SECTIONS.includes(patch.section)) {
    student.section = patch.section;
  }
  if (patch.enrollmentStatus && ['ACTIVE', 'INACTIVE', 'GRADUATED'].includes(patch.enrollmentStatus)) {
    student.enrollmentStatus = patch.enrollmentStatus;
  }
  if (patch.photoDataUrl !== undefined) {
    student.photoDataUrl = patch.photoDataUrl;
  }

  student.updatedAt = new Date().toISOString();
  recordAuditLog({
    actor,
    department: student.department,
    action: 'STUDENT_UPDATED',
    targetType: 'STUDENT',
    targetId: student.registerNo,
    details: `Updated student record for ${student.fullName} (${student.enrollmentStatus}).`,
  });
  writeDbAtomic(dbState);
  return { ok: true, student };
}

export function importStudentsCsv(
  actor: AuthUser,
  csvText: string,
): {
  ok: true;
  imported: number;
  skipped: number;
  errors: string[];
  students: StudentRecord[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { ok: true, imported: 0, skipped: 0, errors: ['CSV input is empty.'], students: [] };
  }

  const startIndex = lines[0].toLowerCase().includes('register') ? 1 : 0;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const createdList: StudentRecord[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 7) {
      skipped += 1;
      errors.push(`Row ${i + 1}: Expected at least 7 columns (registerNo,rollNo,fullName,department,academicYear,section,email,phone).`);
      continue;
    }
    const [registerNo, rollNo, fullName, deptRaw, yearRaw, sectionRaw, email, phone] = cols;
    const dept = (actor.role === 'HOD' && actor.department ? actor.department : deptRaw).toUpperCase();
    if (actor.role === 'HOD' && deptRaw.trim().toUpperCase() !== actor.department) {
      skipped += 1;
      errors.push(`Row ${i + 1}: Skipped cross-department row (${deptRaw}).`);
      continue;
    }
    const normalizedYear = VALID_YEARS.find((y) => y.toLowerCase() === yearRaw.toLowerCase()) ?? '2nd Year';
    const normalizedSec = VALID_SECTIONS.find((s) => s === sectionRaw.toUpperCase()) ?? 'A';

    const res = createStudent(actor, {
      registerNo,
      rollNo,
      fullName,
      department: dept,
      academicYear: normalizedYear,
      section: normalizedSec,
      email,
      phone: phone ?? '',
    });

    if (res.ok) {
      imported += 1;
      createdList.push(res.student);
    } else {
      skipped += 1;
      errors.push(`Row ${i + 1} (${registerNo}): ${res.message}`);
    }
  }

  return { ok: true, imported, skipped, errors, students: createdList };
}

export function importStudentsBatch(
  actor: AuthUser,
  rows: Array<{
    admissionNo?: string;
    registerNo: string;
    rollNo: string;
    fullName: string;
    department?: string;
    academicYear?: string;
    section?: string;
    email?: string;
    phone?: string;
  }>,
): {
  ok: true;
  imported: number;
  skipped: number;
  errors: string[];
  students: StudentRecord[];
} {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, imported: 0, skipped: 0, errors: ['No student rows provided in spreadsheet.'], students: [] };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const createdList: StudentRecord[] = [];

  rows.forEach((row, idx) => {
    const reg = String(row.registerNo ?? '').trim();
    const roll = String(row.rollNo ?? reg).trim();
    const name = String(row.fullName ?? '').trim();
    const rawDept = String(row.department ?? (actor.department ?? 'CSE')).trim().toUpperCase();

    if (actor.role === 'HOD' && rawDept && rawDept !== actor.department) {
      skipped += 1;
      errors.push(`Row ${idx + 1} (${reg || name}): Skipped external department (${rawDept}).`);
      return;
    }

    const dept = actor.role === 'HOD' && actor.department ? actor.department : rawDept;
    const yearStr = String(row.academicYear ?? '2nd Year').trim().toLowerCase();
    const normalizedYear =
      VALID_YEARS.find(
        (y) =>
          y.toLowerCase() === yearStr ||
          (yearStr === '1' && y === '1st Year') ||
          (yearStr === '2' && y === '2nd Year') ||
          (yearStr === '3' && y === '3rd Year') ||
          (yearStr === '4' && y === '4th Year'),
      ) ?? '2nd Year';
    const secStr = String(row.section ?? 'A').trim().toUpperCase();
    const normalizedSec = VALID_SECTIONS.find((s) => s === secStr) ?? 'A';
    const email =
      String(row.email ?? '').trim() ||
      `${(reg || `stu${idx + 1}`).toLowerCase().replace(/[^a-z0-9]/g, '')}@smartattend.edu`;

    const res = createStudent(actor, {
      admissionNo: String(row.admissionNo ?? reg).trim(),
      registerNo: reg,
      rollNo: roll,
      fullName: name,
      department: dept,
      academicYear: normalizedYear,
      section: normalizedSec,
      email,
      phone: String(row.phone ?? '').trim(),
    });

    if (res.ok) {
      imported += 1;
      createdList.push(res.student);
    } else {
      skipped += 1;
      errors.push(`Row ${idx + 1} (${reg || name}): ${res.message}`);
    }
  });

  return { ok: true, imported, skipped, errors, students: createdList };
}

// Face Enrollments (Consent-First Biometric Storage & Revocation)
export function saveFaceEnrollment(
  actor: AuthUser,
  payload: {
    studentId: string;
    consentGranted: boolean;
    descriptor: number[];
    photoDataUrl?: string | null;
  },
): { ok: true; student: StudentRecord; enrollment: FaceEnrollmentRecord } | { ok: false; status: number; message: string } {
  const student = dbState.students.find((s) => s.id === payload.studentId);
  if (!student) {
    return { ok: false, status: 404, message: 'Student record not found.' };
  }
  if (actor.role === 'HOD' && actor.department !== student.department) {
    return { ok: false, status: 403, message: `Access denied: student belongs to ${student.department}.` };
  }
  if (!payload.consentGranted) {
    return { ok: false, status: 400, message: 'Explicit student biometric consent must be verified before saving a face reference.' };
  }
  if (!Array.isArray(payload.descriptor) || payload.descriptor.length !== 128) {
    return { ok: false, status: 400, message: 'Valid 128-dimensional face embedding descriptor is required.' };
  }

  const now = new Date().toISOString();
  student.biometricConsentGranted = true;
  student.biometricConsentAt = now;
  student.biometricRevokedAt = null;
  student.faceEnrollmentStatus = 'ENROLLED';
  if (payload.photoDataUrl) {
    student.photoDataUrl = payload.photoDataUrl;
  }
  student.updatedAt = now;

  let enrollment = dbState.faceEnrollments.find((e) => e.studentId === student.id);
  if (enrollment) {
    enrollment.consentGranted = true;
    enrollment.consentTimestamp = now;
    enrollment.policyVersion = dbState.settings.biometricPolicyVersion;
    enrollment.descriptor = payload.descriptor;
    enrollment.status = 'ACTIVE';
    enrollment.updatedBy = actor.loginId;
    enrollment.updatedAt = now;
  } else {
    enrollment = {
      id: `face-${student.id}`,
      studentId: student.id,
      department: student.department,
      consentGranted: true,
      consentTimestamp: now,
      policyVersion: dbState.settings.biometricPolicyVersion,
      descriptor: payload.descriptor,
      status: 'ACTIVE',
      updatedBy: actor.loginId,
      updatedAt: now,
    };
    dbState.faceEnrollments.push(enrollment);
  }

  recordAuditLog({
    actor,
    department: student.department,
    action: 'BIOMETRIC_ENROLLED',
    targetType: 'STUDENT',
    targetId: student.registerNo,
    details: `Saved consented 128-d face template (${dbState.settings.biometricPolicyVersion}) for ${student.fullName}.`,
  });
  writeDbAtomic(dbState);
  return { ok: true, student, enrollment };
}

export function revokeFaceEnrollment(
  actor: AuthUser,
  studentId: string,
): { ok: true; student: StudentRecord } | { ok: false; status: number; message: string } {
  const student = dbState.students.find((s) => s.id === studentId);
  if (!student) {
    return { ok: false, status: 404, message: 'Student not found.' };
  }
  if (actor.role === 'HOD' && actor.department !== student.department) {
    return { ok: false, status: 403, message: `Access denied: student belongs to ${student.department}.` };
  }

  const now = new Date().toISOString();
  student.biometricConsentGranted = false;
  student.biometricRevokedAt = now;
  student.faceEnrollmentStatus = 'REVOKED';
  student.updatedAt = now;

  // Delete biometric template descriptor completely upon revocation
  dbState.faceEnrollments = dbState.faceEnrollments.filter((e) => e.studentId !== student.id);

  recordAuditLog({
    actor,
    department: student.department,
    action: 'BIOMETRIC_REVOKED',
    targetType: 'STUDENT',
    targetId: student.registerNo,
    details: `Revoked biometric consent and deleted facial descriptor for ${student.fullName}. Student switched to Manual Verification fallback.`,
  });
  writeDbAtomic(dbState);
  return { ok: true, student };
}

// Classrooms & Cameras & Subjects
export function upsertClassroom(
  actor: AuthUser,
  payload: {
    id?: string;
    roomCode: string;
    roomName: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    section: SectionCode;
    floor?: string;
    building?: string;
    capacity: number;
    assignedCameraId?: string | null;
    status?: ClassroomStatus;
  },
): { ok: true; classroom: ClassroomRecord } | { ok: false; status: number; message: string } {
  const dept = payload.department.trim().toUpperCase();
  if (actor.role === 'HOD' && actor.department !== dept) {
    return { ok: false, status: 403, message: `HOD accounts can only manage ${actor.department} classrooms.` };
  }
  const roomCode = payload.roomCode.trim().toUpperCase();
  const roomName = payload.roomName.trim();
  if (!roomCode || roomName.length < 2) {
    return { ok: false, status: 400, message: 'Room code and name are required.' };
  }

  const now = new Date().toISOString();
  if (payload.id) {
    const existing = dbState.classrooms.find((c) => c.id === payload.id);
    if (!existing) {
      return { ok: false, status: 404, message: 'Classroom not found.' };
    }
    if (actor.role === 'HOD' && existing.department !== actor.department) {
      return { ok: false, status: 403, message: 'Access denied to another department classroom.' };
    }
    existing.roomCode = roomCode;
    existing.roomName = roomName;
    if (actor.role === 'ADMINISTRATION') existing.department = dept;
    existing.academicYear = payload.academicYear;
    existing.section = payload.section;
    existing.floor = (payload.floor ?? existing.floor).trim();
    existing.building = (payload.building ?? existing.building).trim();
    existing.capacity = Math.max(1, Math.round(payload.capacity || existing.capacity));
    if (payload.assignedCameraId !== undefined) existing.assignedCameraId = payload.assignedCameraId;
    if (payload.status) existing.status = payload.status;
    existing.updatedAt = now;
    writeDbAtomic(dbState);
    return { ok: true, classroom: existing };
  }

  const created: ClassroomRecord = {
    id: makeId('cls'),
    roomCode,
    roomName,
    department: dept,
    academicYear: payload.academicYear,
    section: payload.section,
    floor: (payload.floor ?? '1st Floor').trim(),
    building: (payload.building ?? 'Main Academic Block').trim(),
    capacity: Math.max(1, Math.round(payload.capacity || 60)),
    assignedCameraId: payload.assignedCameraId ?? null,
    status: payload.status ?? 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  dbState.classrooms.push(created);
  recordAuditLog({
    actor,
    department: created.department,
    action: 'CLASSROOM_CREATED',
    targetType: 'CLASSROOM',
    targetId: created.roomCode,
    details: `Registered classroom ${created.roomCode} (${created.roomName}).`,
  });
  writeDbAtomic(dbState);
  return { ok: true, classroom: created };
}

export function upsertCamera(
  actor: AuthUser,
  payload: {
    id?: string;
    cameraCode: string;
    cameraNumber?: string;
    name: string;
    classroomId?: string | null;
    department: DepartmentCode;
    academicYear?: AcademicYear | 'COMMON';
    section?: SectionCode | 'COMMON';
    isSharedLab?: boolean;
    authorizedDepartments?: DepartmentCode[];
    sourceType: CameraSourceType;
    connectionLabel?: string;
    gatewayUrl?: string;
    online?: boolean;
    monitoringActive?: boolean;
    lastError?: string | null;
  },
): { ok: true; camera: CameraRecord } | { ok: false; status: number; message: string } {
  const dept = payload.department.trim().toUpperCase();
  if (actor.role === 'HOD' && actor.department !== dept) {
    return { ok: false, status: 403, message: `HOD accounts can only manage ${actor.department} cameras.` };
  }

  const now = new Date().toISOString();
  if (payload.id) {
    const cam = dbState.cameras.find((c) => c.id === payload.id);
    if (!cam) return { ok: false, status: 404, message: 'Camera not found.' };
    if (actor.role === 'HOD' && cam.department !== actor.department) {
      return { ok: false, status: 403, message: 'Access denied to external department camera.' };
    }
    if (payload.name) cam.name = payload.name.trim();
    if (payload.cameraCode) cam.cameraCode = payload.cameraCode.trim().toUpperCase();
    if (payload.cameraNumber) cam.cameraNumber = payload.cameraNumber.trim().toUpperCase();
    if (payload.classroomId !== undefined) cam.classroomId = payload.classroomId;
    if (actor.role === 'ADMINISTRATION' && payload.department) cam.department = dept;
    if (payload.academicYear) cam.academicYear = payload.academicYear;
    if (payload.section) cam.section = payload.section;
    if (actor.role === 'ADMINISTRATION' && typeof payload.isSharedLab === 'boolean') {
      cam.isSharedLab = payload.isSharedLab;
    }
    if (actor.role === 'ADMINISTRATION' && Array.isArray(payload.authorizedDepartments)) {
      const cleaned = [...new Set(payload.authorizedDepartments.map((d) => d.trim().toUpperCase()))].filter(Boolean);
      if (!cleaned.includes(cam.department)) cleaned.unshift(cam.department);
      cam.authorizedDepartments = cleaned;
    }
    if (payload.sourceType) cam.sourceType = payload.sourceType;
    if (payload.connectionLabel !== undefined) cam.connectionLabel = payload.connectionLabel.trim();
    if (payload.gatewayUrl !== undefined) cam.gatewayUrl = payload.gatewayUrl.trim();
    if (typeof payload.online === 'boolean') cam.online = payload.online;
    if (typeof payload.monitoringActive === 'boolean') cam.monitoringActive = payload.monitoringActive;
    if (payload.lastError !== undefined) cam.lastError = payload.lastError;
    if (cam.online) cam.lastHeartbeatAt = now;
    cam.updatedAt = now;

    if (cam.classroomId) {
      const room = dbState.classrooms.find((r) => r.id === cam.classroomId);
      if (room) room.assignedCameraId = cam.id;
    }

    writeDbAtomic(dbState);
    return { ok: true, camera: cam };
  }

  const room = payload.classroomId ? dbState.classrooms.find((r) => r.id === payload.classroomId) : null;
  const authDepts =
    actor.role === 'ADMINISTRATION' && Array.isArray(payload.authorizedDepartments) && payload.authorizedDepartments.length > 0
      ? [...new Set([dept, ...payload.authorizedDepartments.map((d) => d.trim().toUpperCase())])]
      : [dept];

  const created: CameraRecord = {
    id: makeId('cam'),
    cameraCode: payload.cameraCode.trim().toUpperCase(),
    cameraNumber: (payload.cameraNumber || `CAMERA ${String(dbState.cameras.length + 1).padStart(2, '0')}`).trim().toUpperCase(),
    name: payload.name.trim(),
    classroomId: payload.classroomId ?? null,
    department: dept,
    academicYear: payload.academicYear ?? room?.academicYear ?? '2nd Year',
    section: payload.section ?? room?.section ?? 'A',
    isSharedLab: actor.role === 'ADMINISTRATION' ? Boolean(payload.isSharedLab) : false,
    authorizedDepartments: authDepts,
    sourceType: payload.sourceType,
    connectionLabel: (payload.connectionLabel ?? '').trim() ||
      (payload.sourceType === 'WEBCAM'
        ? 'Local Browser MediaStream (getUserMedia)'
        : payload.sourceType === 'DEMO_VIDEO'
          ? 'Uploaded Demo Classroom Video Feed'
          : 'RTSP Gateway Bridge Required'),
    gatewayUrl: (payload.gatewayUrl ?? '').trim(),
    online: payload.sourceType === 'RTSP_GATEWAY' ? Boolean(payload.gatewayUrl?.trim()) : (payload.online ?? true),
    monitoringActive: false,
    lastError:
      payload.sourceType === 'RTSP_GATEWAY' && !payload.gatewayUrl?.trim()
        ? 'Gateway bridge URL not configured; raw RTSP cannot stream directly in browser.'
        : null,
    lastHeartbeatAt: payload.sourceType === 'RTSP_GATEWAY' ? null : now,
    createdAt: now,
    updatedAt: now,
  };
  dbState.cameras.push(created);
  if (created.classroomId) {
    const boundRoom = dbState.classrooms.find((r) => r.id === created.classroomId);
    if (boundRoom) boundRoom.assignedCameraId = created.id;
  }
  recordAuditLog({
    actor,
    department: created.department,
    action: 'CAMERA_REGISTERED',
    targetType: 'CAMERA',
    targetId: created.cameraCode,
    details: `Registered ${created.cameraNumber} (${created.cameraCode}, ${created.sourceType}).`,
  });
  writeDbAtomic(dbState);
  return { ok: true, camera: created };
}

export function createSubject(
  actor: AuthUser,
  payload: {
    subjectCode: string;
    subjectName: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    facultyName: string;
    credits?: number;
  },
): { ok: true; subject: SubjectRecord } | { ok: false; status: number; message: string } {
  const dept = payload.department.trim().toUpperCase();
  if (actor.role === 'HOD' && actor.department !== dept) {
    return { ok: false, status: 403, message: `HOD accounts can only create subjects for ${actor.department}.` };
  }
  const code = payload.subjectCode.trim().toUpperCase();
  const name = payload.subjectName.trim();
  const faculty = payload.facultyName.trim();
  if (!code || name.length < 2 || faculty.length < 2) {
    return { ok: false, status: 400, message: 'Subject code, name, and faculty name are required.' };
  }
  const now = new Date().toISOString();
  const subject: SubjectRecord = {
    id: makeId('sub'),
    subjectCode: code,
    subjectName: name,
    department: dept,
    academicYear: payload.academicYear,
    facultyName: faculty,
    credits: Number(payload.credits || 3),
    createdAt: now,
    updatedAt: now,
  };
  dbState.subjects.push(subject);
  writeDbAtomic(dbState);
  return { ok: true, subject };
}

// Timetable Periods, Holidays & Overrides
export function upsertTimetablePeriod(
  actor: AuthUser,
  payload: {
    id?: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    section: SectionCode;
    dayOfWeek: DayOfWeek;
    periodNumber: number;
    periodLabel?: string;
    startTime: string;
    endTime: string;
    subjectId?: string | null;
    subjectCode?: string;
    subjectName?: string;
    facultyName?: string;
    classroomId?: string | null;
    isBreak?: boolean;
    status?: 'ACTIVE' | 'CANCELLED';
  },
): { ok: true; period: TimetablePeriodRecord } | { ok: false; status: number; message: string } {
  const dept = payload.department.trim().toUpperCase();
  if (actor.role === 'HOD' && actor.department !== dept) {
    return { ok: false, status: 403, message: `HOD accounts can only manage ${actor.department} timetables.` };
  }
  if (!payload.startTime || !payload.endTime || payload.startTime >= payload.endTime) {
    return { ok: false, status: 400, message: 'Valid period start and end time (end > start) are required.' };
  }

  const subject = payload.subjectId ? dbState.subjects.find((s) => s.id === payload.subjectId) : null;
  const now = new Date().toISOString();
  const isBreak = Boolean(payload.isBreak);
  const periodNumber = isBreak ? 0 : Math.max(1, Math.round(Number(payload.periodNumber || 1)));
  const periodLabel = (payload.periodLabel || (isBreak ? 'Break' : `Period ${periodNumber}`)).trim();
  const subjectCode = isBreak ? 'BREAK' : (payload.subjectCode || subject?.subjectCode || 'SUB').trim().toUpperCase();
  const subjectName = isBreak ? periodLabel : (payload.subjectName || subject?.subjectName || '').trim();
  const facultyName = isBreak ? '—' : (payload.facultyName || subject?.facultyName || 'Department Faculty').trim();

  if (!isBreak && subjectName.length < 2) {
    return { ok: false, status: 400, message: 'Subject name is required for teaching periods.' };
  }

  if (payload.id) {
    const existing = dbState.timetablePeriods.find((p) => p.id === payload.id);
    if (!existing) return { ok: false, status: 404, message: 'Timetable period not found.' };
    if (actor.role === 'HOD' && existing.department !== actor.department) {
      return { ok: false, status: 403, message: 'Access denied to external department timetable.' };
    }
    existing.academicYear = payload.academicYear;
    existing.section = payload.section;
    existing.dayOfWeek = payload.dayOfWeek;
    existing.periodNumber = periodNumber;
    existing.periodLabel = periodLabel;
    existing.startTime = payload.startTime;
    existing.endTime = payload.endTime;
    existing.subjectId = subject?.id ?? payload.subjectId ?? null;
    existing.subjectCode = subjectCode;
    existing.subjectName = subjectName;
    existing.facultyName = facultyName;
    if (payload.classroomId !== undefined) existing.classroomId = payload.classroomId;
    existing.isBreak = isBreak;
    if (payload.status) existing.status = payload.status;
    existing.updatedAt = now;

    recordAuditLog({
      actor,
      department: existing.department,
      action: 'TIMETABLE_UPDATED',
      targetType: 'TIMETABLE',
      targetId: existing.id,
      details: `Updated ${existing.dayOfWeek} ${existing.periodLabel} (${existing.startTime}-${existing.endTime}): ${existing.subjectName}.`,
    });
    writeDbAtomic(dbState);
    return { ok: true, period: existing };
  }

  const created: TimetablePeriodRecord = {
    id: makeId('tt'),
    department: dept,
    academicYear: payload.academicYear,
    section: payload.section,
    dayOfWeek: payload.dayOfWeek,
    periodNumber,
    periodLabel,
    startTime: payload.startTime,
    endTime: payload.endTime,
    subjectId: subject?.id ?? payload.subjectId ?? null,
    subjectCode,
    subjectName,
    facultyName,
    classroomId: payload.classroomId ?? null,
    isBreak,
    status: payload.status ?? 'ACTIVE',
    updatedAt: now,
  };
  dbState.timetablePeriods.push(created);
  recordAuditLog({
    actor,
    department: created.department,
    action: 'TIMETABLE_PERIOD_ADDED',
    targetType: 'TIMETABLE',
    targetId: created.id,
    details: `Added ${created.dayOfWeek} ${created.periodLabel} (${created.startTime}-${created.endTime}): ${created.subjectName}.`,
  });
  writeDbAtomic(dbState);
  return { ok: true, period: created };
}

export function deleteTimetablePeriod(
  actor: AuthUser,
  id: string,
): { ok: true } | { ok: false; status: number; message: string } {
  const existing = dbState.timetablePeriods.find((p) => p.id === id);
  if (!existing) return { ok: false, status: 404, message: 'Timetable period not found.' };
  if (actor.role === 'HOD' && existing.department !== actor.department) {
    return { ok: false, status: 403, message: 'Access denied to external department timetable.' };
  }
  dbState.timetablePeriods = dbState.timetablePeriods.filter((p) => p.id !== id);
  writeDbAtomic(dbState);
  return { ok: true };
}

export function createHoliday(
  actor: AuthUser,
  payload: { date: string; title: string; department?: string; type?: 'HOLIDAY' | 'CANCELLED_DAY' | 'SPECIAL_EVENT' },
): { ok: true; holiday: TimetableHolidayRecord } | { ok: false; status: number; message: string } {
  const dept = actor.role === 'HOD' && actor.department ? actor.department : (payload.department || 'ALL').toUpperCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !payload.title?.trim()) {
    return { ok: false, status: 400, message: 'Valid YYYY-MM-DD date and holiday title are required.' };
  }
  const holiday: TimetableHolidayRecord = {
    id: makeId('hol'),
    date: payload.date,
    title: payload.title.trim(),
    department: dept,
    type: payload.type ?? 'HOLIDAY',
    createdAt: new Date().toISOString(),
  };
  dbState.holidays.unshift(holiday);
  recordAuditLog({
    actor,
    department: dept === 'ALL' ? null : dept,
    action: 'HOLIDAY_SCHEDULED',
    targetType: 'TIMETABLE',
    targetId: holiday.date,
    details: `Marked ${holiday.date} as ${holiday.type}: ${holiday.title} (${holiday.department}).`,
  });
  writeDbAtomic(dbState);
  return { ok: true, holiday };
}

export function deleteHoliday(
  actor: AuthUser,
  id: string,
): { ok: true } | { ok: false; status: number; message: string } {
  const existing = dbState.holidays.find((h) => h.id === id);
  if (!existing) return { ok: false, status: 404, message: 'Holiday entry not found.' };
  if (actor.role === 'HOD' && existing.department !== actor.department) {
    return { ok: false, status: 403, message: 'Access denied to delete institutional/external holiday.' };
  }
  dbState.holidays = dbState.holidays.filter((h) => h.id !== id);
  writeDbAtomic(dbState);
  return { ok: true };
}

export function upsertTimetableOverride(
  actor: AuthUser,
  payload: {
    date: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    section: SectionCode;
    periodNumber: number;
    overrideType: 'CANCELLED' | 'SUBSTITUTION';
    subjectId?: string | null;
    subjectCode?: string;
    subjectName?: string;
    facultyName?: string;
    classroomId?: string | null;
    reason?: string;
  },
): { ok: true; override: TimetableOverrideRecord } | { ok: false; status: number; message: string } {
  const dept = payload.department.trim().toUpperCase();
  if (actor.role === 'HOD' && actor.department !== dept) {
    return { ok: false, status: 403, message: `HOD accounts can only override ${actor.department} schedules.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return { ok: false, status: 400, message: 'Valid YYYY-MM-DD date is required.' };
  }
  const sub = payload.subjectId ? dbState.subjects.find((s) => s.id === payload.subjectId) : null;
  const now = new Date().toISOString();
  const existing = dbState.timetableOverrides.find(
    (o) =>
      o.date === payload.date &&
      o.department === dept &&
      o.academicYear === payload.academicYear &&
      o.section === payload.section &&
      o.periodNumber === payload.periodNumber,
  );
  if (existing) {
    existing.overrideType = payload.overrideType;
    existing.subjectId = sub?.id ?? payload.subjectId ?? null;
    existing.subjectCode = (payload.subjectCode || sub?.subjectCode || '').trim().toUpperCase();
    existing.subjectName = (payload.subjectName || sub?.subjectName || '').trim();
    existing.facultyName = (payload.facultyName || sub?.facultyName || '').trim();
    if (payload.classroomId !== undefined) existing.classroomId = payload.classroomId;
    existing.reason = (payload.reason || '').trim();
    existing.updatedAt = now;
    writeDbAtomic(dbState);
    return { ok: true, override: existing };
  }

  const created: TimetableOverrideRecord = {
    id: makeId('ovr'),
    date: payload.date,
    department: dept,
    academicYear: payload.academicYear,
    section: payload.section,
    periodNumber: Math.max(1, Math.round(payload.periodNumber)),
    overrideType: payload.overrideType,
    subjectId: sub?.id ?? payload.subjectId ?? null,
    subjectCode: (payload.subjectCode || sub?.subjectCode || '').trim().toUpperCase(),
    subjectName: (payload.subjectName || sub?.subjectName || '').trim(),
    facultyName: (payload.facultyName || sub?.facultyName || '').trim(),
    classroomId: payload.classroomId ?? null,
    reason: (payload.reason || '').trim(),
    updatedAt: now,
  };
  dbState.timetableOverrides.unshift(created);
  writeDbAtomic(dbState);
  return { ok: true, override: created };
}

export function deleteTimetableOverride(
  actor: AuthUser,
  id: string,
): { ok: true } | { ok: false; status: number; message: string } {
  const existing = dbState.timetableOverrides.find((o) => o.id === id);
  if (!existing) return { ok: false, status: 404, message: 'Override not found.' };
  if (actor.role === 'HOD' && existing.department !== actor.department) {
    return { ok: false, status: 403, message: 'Access denied.' };
  }
  dbState.timetableOverrides = dbState.timetableOverrides.filter((o) => o.id !== id);
  writeDbAtomic(dbState);
  return { ok: true };
}

// Class Sessions & Attendance Management
export function createClassSession(
  actor: AuthUser,
  payload: {
    department: DepartmentCode;
    academicYear: AcademicYear;
    section: SectionCode;
    classroomId: string;
    cameraId?: string | null;
    subjectId?: string;
    periodNumber?: number;
    periodLabel?: string;
    sessionDate?: string;
    startTime?: string;
    endTime?: string;
    status?: 'SCHEDULED' | 'LIVE';
  },
): { ok: true; session: ClassSessionRecord } | { ok: false; status: number; message: string } {
  const dept = payload.department.trim().toUpperCase();
  if (actor.role === 'HOD' && actor.department !== dept) {
    return { ok: false, status: 403, message: `Access denied: cannot open session for ${dept}.` };
  }
  const classroom = dbState.classrooms.find((c) => c.id === payload.classroomId);
  if (!classroom || classroom.department !== dept) {
    return { ok: false, status: 400, message: 'Selected classroom is invalid for this department.' };
  }

  const resolvedTt = resolveCurrentTimetableContext({
    department: dept,
    academicYear: payload.academicYear,
    section: payload.section,
    classroomId: classroom.id,
    timezone: dbState.settings.institutionTimezone,
    overrideDateStr: payload.sessionDate,
    periods: dbState.timetablePeriods,
    holidays: dbState.holidays,
    overrides: dbState.timetableOverrides,
  });

  const targetSubjectId =
    payload.subjectId ||
    resolvedTt.subjectId ||
    dbState.subjects.find((s) => s.department === dept && s.academicYear === payload.academicYear)?.id ||
    dbState.subjects.find((s) => s.department === dept)?.id;

  const subject = dbState.subjects.find((s) => s.id === targetSubjectId);
  if (!subject) {
    return { ok: false, status: 400, message: 'Selected subject was not found.' };
  }

  const periodNumber =
    typeof payload.periodNumber === 'number' && payload.periodNumber >= 1
      ? Math.round(payload.periodNumber)
      : (resolvedTt.periodNumber ?? 1);
  const periodLabel = (payload.periodLabel || `Period ${periodNumber}`).trim();

  const now = new Date();
  const nowIso = now.toISOString();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  const session: ClassSessionRecord = {
    id: makeId('sess'),
    department: dept,
    academicYear: payload.academicYear,
    section: payload.section,
    classroomId: classroom.id,
    cameraId: payload.cameraId ?? classroom.assignedCameraId ?? null,
    subjectId: subject.id,
    subjectName: `${subject.subjectCode} · ${subject.subjectName}`,
    facultyName: subject.facultyName,
    periodNumber,
    periodLabel,
    sessionDate: payload.sessionDate ?? resolvedTt.dateStr ?? todayDateStr(),
    startTime: payload.startTime ?? resolvedTt.startTime ?? `${hh}:${mm}`,
    endTime: payload.endTime ?? resolvedTt.endTime ?? '',
    status: payload.status ?? 'LIVE',
    finalizedAt: null,
    finalizedBy: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  dbState.sessions.unshift(session);
  recordAuditLog({
    actor,
    department: session.department,
    action: 'SESSION_STARTED',
    targetType: 'SESSION',
    targetId: session.id,
    details: `Started ${session.status} session (${session.periodLabel}) for ${session.department} ${session.academicYear} Sec ${session.section} in ${classroom.roomCode}.`,
  });
  writeDbAtomic(dbState);
  return { ok: true, session };
}

export function upsertAttendanceMark(
  actor: AuthUser,
  payload: {
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    verificationSource: AttendanceSource;
    confidence?: number | null;
    livenessPassed?: boolean | null;
    correctionReason?: string | null;
  },
): { ok: true; record: AttendanceRecord } | { ok: false; status: number; message: string } {
  const session = dbState.sessions.find((s) => s.id === payload.sessionId);
  if (!session) {
    return { ok: false, status: 404, message: 'Class session not found.' };
  }
  const student = dbState.students.find((s) => s.id === payload.studentId);
  if (!student) {
    return { ok: false, status: 404, message: 'Student not found.' };
  }
  if (actor.role === 'HOD' && (actor.department !== session.department || actor.department !== student.department)) {
    return { ok: false, status: 403, message: 'Access denied to external department attendance record.' };
  }
  if (session.status === 'FINALIZED' && actor.role === 'HOD' && !payload.correctionReason?.trim()) {
    return { ok: false, status: 400, message: 'A documented reason is required when amending finalized session attendance.' };
  }

  const now = new Date().toISOString();
  const compositeId = `${session.id}__${student.id}`;
  let existing = dbState.attendance.find(
    (a) => a.id === compositeId || (a.sessionId === session.id && a.studentId === student.id),
  );

  if (existing) {
    // Prevent duplicate; avoid downgrading a confirmed PRESENT via redundant automated vision scan
    if (
      payload.verificationSource === 'AI_VISION' &&
      existing.status === 'PRESENT' &&
      payload.status === 'PENDING_VERIFICATION'
    ) {
      return { ok: true, record: existing };
    }
    const prevStatus = existing.status;
    existing.status = payload.status;
    existing.verificationSource = payload.verificationSource;
    existing.verificationStatus =
      payload.verificationSource === 'HOD_CORRECTION'
        ? 'MANUALLY_CORRECTED'
        : payload.verificationSource === 'AI_VISION'
          ? payload.status === 'PENDING_VERIFICATION'
            ? 'PENDING_REVIEW'
            : 'VERIFIED_AI'
          : 'MANUAL_VERIFIED';
    if (payload.confidence !== undefined) existing.confidence = payload.confidence;
    if (payload.livenessPassed !== undefined) existing.livenessPassed = payload.livenessPassed;
    if (payload.correctionReason !== undefined) existing.correctionReason = payload.correctionReason;
    if (payload.verificationSource === 'AI_VISION') existing.recognitionTimestamp = now;
    existing.updatedAt = now;
    existing.updatedBy = actor.loginId;

    if (payload.verificationSource === 'HOD_CORRECTION' || prevStatus !== payload.status) {
      recordAuditLog({
        actor,
        department: session.department,
        action: 'ATTENDANCE_UPDATED',
        targetType: 'ATTENDANCE',
        targetId: existing.id,
        details: `${student.registerNo} (${student.fullName}, ${session.periodLabel}): ${prevStatus} -> ${payload.status}${payload.correctionReason ? ` (${payload.correctionReason})` : ''}.`,
      });
    }
    writeDbAtomic(dbState);
    return { ok: true, record: existing };
  }

  existing = {
    id: compositeId,
    sessionId: session.id,
    studentId: student.id,
    registerNo: student.registerNo,
    studentName: student.fullName,
    department: session.department,
    academicYear: student.academicYear,
    section: student.section,
    subjectId: session.subjectId,
    subjectName: session.subjectName,
    periodNumber: session.periodNumber ?? 1,
    periodLabel: session.periodLabel || 'Period 1',
    sessionDate: session.sessionDate,
    status: payload.status,
    verificationSource: payload.verificationSource,
    verificationStatus:
      payload.verificationSource === 'HOD_CORRECTION'
        ? 'MANUALLY_CORRECTED'
        : payload.verificationSource === 'AI_VISION'
          ? payload.status === 'PENDING_VERIFICATION'
            ? 'PENDING_REVIEW'
            : 'VERIFIED_AI'
          : 'MANUAL_VERIFIED',
    confidence: payload.confidence ?? null,
    livenessPassed: payload.livenessPassed ?? null,
    correctionReason: payload.correctionReason ?? null,
    recognitionTimestamp: payload.verificationSource === 'AI_VISION' ? now : null,
    markedAt: now,
    updatedAt: now,
    updatedBy: actor.loginId,
  };
  dbState.attendance.push(existing);

  if (payload.verificationSource !== 'AI_VISION') {
    recordAuditLog({
      actor,
      department: session.department,
      action: 'ATTENDANCE_MARKED',
      targetType: 'ATTENDANCE',
      targetId: existing.id,
      details: `Marked ${student.registerNo} (${student.fullName}, ${session.periodLabel}) as ${payload.status} (${payload.verificationSource}).`,
    });
  }
  writeDbAtomic(dbState);
  return { ok: true, record: existing };
}

export function finalizeClassSession(
  actor: AuthUser,
  sessionId: string,
): {
  ok: true;
  session: ClassSessionRecord;
  newlyMarkedAbsent: number;
} | { ok: false; status: number; message: string } {
  const session = dbState.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { ok: false, status: 404, message: 'Class session not found.' };
  }
  if (actor.role === 'HOD' && actor.department !== session.department) {
    return { ok: false, status: 403, message: 'Access denied to finalize another department session.' };
  }

  const now = new Date().toISOString();
  const cohortStudents = dbState.students.filter(
    (st) =>
      st.enrollmentStatus === 'ACTIVE' &&
      st.department === session.department &&
      st.academicYear === session.academicYear &&
      st.section === session.section,
  );

  let newlyMarkedAbsent = 0;
  for (const stu of cohortStudents) {
    const alreadyMarked = dbState.attendance.some(
      (a) => a.sessionId === session.id && a.studentId === stu.id,
    );
    if (!alreadyMarked) {
      dbState.attendance.push({
        id: `${session.id}__${stu.id}`,
        sessionId: session.id,
        studentId: stu.id,
        registerNo: stu.registerNo,
        studentName: stu.fullName,
        department: session.department,
        academicYear: stu.academicYear,
        section: stu.section,
        subjectId: session.subjectId,
        subjectName: session.subjectName,
        periodNumber: session.periodNumber ?? 1,
        periodLabel: session.periodLabel || 'Period 1',
        sessionDate: session.sessionDate,
        status: 'ABSENT',
        verificationSource: 'MANUAL',
        verificationStatus: 'MANUAL_VERIFIED',
        confidence: null,
        livenessPassed: null,
        correctionReason: 'Session finalized — student unmarked during session window',
        recognitionTimestamp: null,
        markedAt: now,
        updatedAt: now,
        updatedBy: actor.loginId,
      });
      newlyMarkedAbsent += 1;
    }
  }

  session.status = 'FINALIZED';
  session.finalizedAt = now;
  session.finalizedBy = actor.loginId;
  if (!session.endTime) {
    const d = new Date();
    session.endTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  session.updatedAt = now;

  recordAuditLog({
    actor,
    department: session.department,
    action: 'SESSION_FINALIZED',
    targetType: 'SESSION',
    targetId: session.id,
    details: `Finalized ${session.subjectName} (${session.academicYear} Sec ${session.section}); ${newlyMarkedAbsent} unmarked student(s) marked ABSENT.`,
  });
  writeDbAtomic(dbState);
  return { ok: true, session, newlyMarkedAbsent };
}

export function logRecognitionEvent(
  actor: AuthUser,
  payload: {
    sessionId: string;
    cameraId: string;
    matchedStudentId: string | null;
    confidence: number;
    livenessStatus: LivenessStatus;
    outcome: RecognitionOutcome;
  },
): {
  ok: true;
  event: RecognitionEventRecord;
  attendanceRecord?: AttendanceRecord;
} | { ok: false; status: number; message: string } {
  const session = dbState.sessions.find((s) => s.id === payload.sessionId);
  if (!session) {
    return { ok: false, status: 404, message: 'Session not found.' };
  }
  if (actor.role === 'HOD' && actor.department !== session.department) {
    return { ok: false, status: 403, message: 'Access denied to external department recognition stream.' };
  }

  const matchedStudent = payload.matchedStudentId
    ? dbState.students.find((s) => s.id === payload.matchedStudentId) ?? null
    : null;

  const now = new Date().toISOString();
  const event: RecognitionEventRecord = {
    id: makeId('evt'),
    sessionId: session.id,
    cameraId: payload.cameraId,
    department: session.department,
    matchedStudentId: matchedStudent?.id ?? null,
    matchedStudentName: matchedStudent?.fullName ?? null,
    matchedRegisterNo: matchedStudent?.registerNo ?? null,
    confidence: Number(payload.confidence.toFixed(3)),
    livenessStatus: payload.livenessStatus,
    outcome: payload.outcome,
    capturedAt: now,
    reviewed: payload.outcome === 'MATCHED_PRESENT',
    reviewedAction: null,
  };

  dbState.recognitionEvents.unshift(event);
  if (dbState.recognitionEvents.length > 300) {
    dbState.recognitionEvents.length = 300;
  }

  let attendanceRecord: AttendanceRecord | undefined;
  if (matchedStudent && (payload.outcome === 'MATCHED_PRESENT' || payload.outcome === 'PENDING_VERIFICATION' || payload.outcome === 'LIVENESS_WARNING')) {
    const statusToAssign: AttendanceStatus =
      payload.outcome === 'MATCHED_PRESENT' ? 'PRESENT' : 'PENDING_VERIFICATION';
    const markRes = upsertAttendanceMark(actor, {
      sessionId: session.id,
      studentId: matchedStudent.id,
      status: statusToAssign,
      verificationSource: 'AI_VISION',
      confidence: event.confidence,
      livenessPassed: payload.livenessStatus === 'VERIFIED',
      correctionReason:
        payload.outcome === 'LIVENESS_WARNING'
          ? 'Flagged for manual verification due to static-frame liveness warning'
          : null,
    });
    if (markRes.ok) {
      attendanceRecord = markRes.record;
    }
  } else {
    writeDbAtomic(dbState);
  }

  return { ok: true, event, attendanceRecord };
}

// Optional Sample Demonstration Data (Explicitly Requested Toggle)
export function loadSampleDemonstrationData(actor: AuthUser): SmartAttendDatabase {
  const now = new Date().toISOString();
  const sampleSpecs: Array<{
    registerNo: string;
    rollNo: string;
    fullName: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    section: SectionCode;
    email: string;
    phone: string;
  }> = [
    { registerNo: '23CSE001', rollNo: 'CS01', fullName: 'Aarav Subramanian', department: 'CSE', academicYear: '2nd Year', section: 'A', email: 'aarav.s@smartattend.edu', phone: '+91 98401 11001' },
    { registerNo: '23CSE002', rollNo: 'CS02', fullName: 'Diya Raghavan', department: 'CSE', academicYear: '2nd Year', section: 'A', email: 'diya.r@smartattend.edu', phone: '+91 98401 11002' },
    { registerNo: '23CSE003', rollNo: 'CS03', fullName: 'Rohan Venkatesh', department: 'CSE', academicYear: '2nd Year', section: 'A', email: 'rohan.v@smartattend.edu', phone: '+91 98401 11003' },
    { registerNo: '23CSE004', rollNo: 'CS04', fullName: 'Nandini Balaji', department: 'CSE', academicYear: '2nd Year', section: 'A', email: 'nandini.b@smartattend.edu', phone: '+91 98401 11004' },
    { registerNo: '23CSE005', rollNo: 'CS05', fullName: 'Pranav Natarajan', department: 'CSE', academicYear: '2nd Year', section: 'A', email: 'pranav.n@smartattend.edu', phone: '+91 98401 11005' },
    { registerNo: '22CSE011', rollNo: 'CS11', fullName: 'Harini Sundaram', department: 'CSE', academicYear: '3rd Year', section: 'A', email: 'harini.s@smartattend.edu', phone: '+91 98401 11011' },
    { registerNo: '22CSE012', rollNo: 'CS12', fullName: 'Kishore Menon', department: 'CSE', academicYear: '3rd Year', section: 'A', email: 'kishore.m@smartattend.edu', phone: '+91 98401 11012' },
    { registerNo: '24IT001', rollNo: 'IT01', fullName: 'Sneha Rajagopal', department: 'IT', academicYear: '1st Year', section: 'A', email: 'sneha.r@smartattend.edu', phone: '+91 98401 22001' },
    { registerNo: '24IT002', rollNo: 'IT02', fullName: 'Varun Deshpande', department: 'IT', academicYear: '1st Year', section: 'A', email: 'varun.d@smartattend.edu', phone: '+91 98401 22002' },
    { registerNo: '24IT003', rollNo: 'IT03', fullName: 'Meera Chatterjee', department: 'IT', academicYear: '1st Year', section: 'A', email: 'meera.c@smartattend.edu', phone: '+91 98401 22003' },
    { registerNo: '21IT014', rollNo: 'IT14', fullName: 'Aditya Narasimhan', department: 'IT', academicYear: '4th Year', section: 'B', email: 'aditya.n@smartattend.edu', phone: '+91 98401 22014' },
    { registerNo: '23AIML001', rollNo: 'AL01', fullName: 'Ishaan Sharma', department: 'AIML', academicYear: '2nd Year', section: 'A', email: 'ishaan.s@smartattend.edu', phone: '+91 98401 33001' },
    { registerNo: '23AIML002', rollNo: 'AL02', fullName: 'Tanvi Joshi', department: 'AIML', academicYear: '2nd Year', section: 'A', email: 'tanvi.j@smartattend.edu', phone: '+91 98401 33002' },
    { registerNo: '23AIML003', rollNo: 'AL03', fullName: 'Devansh Verma', department: 'AIML', academicYear: '2nd Year', section: 'A', email: 'devansh.v@smartattend.edu', phone: '+91 98401 33003' },
    { registerNo: '22AIML008', rollNo: 'AL08', fullName: 'Riya Bansal', department: 'AIML', academicYear: '3rd Year', section: 'A', email: 'riya.b@smartattend.edu', phone: '+91 98401 33008' },
    { registerNo: '24AIDS001', rollNo: 'AD01', fullName: 'Siddharth Nair', department: 'AIDS', academicYear: '1st Year', section: 'A', email: 'siddharth.n@smartattend.edu', phone: '+91 98401 44001' },
    { registerNo: '24AIDS002', rollNo: 'AD02', fullName: 'Ananya Hegde', department: 'AIDS', academicYear: '1st Year', section: 'A', email: 'ananya.h@smartattend.edu', phone: '+91 98401 44002' },
    { registerNo: '24AIDS003', rollNo: 'AD03', fullName: 'Nikhil Gowda', department: 'AIDS', academicYear: '1st Year', section: 'A', email: 'nikhil.g@smartattend.edu', phone: '+91 98401 44003' },
    { registerNo: '21AIDS010', rollNo: 'AD10', fullName: 'Shruti Mahajan', department: 'AIDS', academicYear: '4th Year', section: 'A', email: 'shruti.m@smartattend.edu', phone: '+91 98401 44010' },
  ];

  const createdStudents: StudentRecord[] = [];
  for (const spec of sampleSpecs) {
    const existing = dbState.students.find((s) => s.registerNo === spec.registerNo);
    if (existing) {
      createdStudents.push(existing);
      continue;
    }
    const stu: StudentRecord = {
      id: `stu-sample-${spec.registerNo.toLowerCase()}`,
      registerNo: spec.registerNo,
      rollNo: spec.rollNo,
      fullName: spec.fullName,
      department: spec.department,
      academicYear: spec.academicYear,
      section: spec.section,
      email: spec.email,
      phone: spec.phone,
      photoDataUrl: null,
      enrollmentStatus: 'ACTIVE',
      biometricConsentGranted: false,
      biometricConsentAt: null,
      biometricRevokedAt: null,
      faceEnrollmentStatus: 'NOT_ENROLLED',
      createdAt: now,
      updatedAt: now,
    };
    dbState.students.push(stu);
    createdStudents.push(stu);
  }

  // Create multi-day finalized sample sessions + 1 live session in CSE 2nd Year Sec A
  const sampleSessionConfigs: Array<{
    id: string;
    dept: DepartmentCode;
    year: AcademicYear;
    section: SectionCode;
    classroomId: string;
    cameraId: string | null;
    subjectId: string;
    periodNumber: number;
    periodLabel: string;
    dayOffset: number;
    startTime: string;
    endTime: string;
    status: 'LIVE' | 'FINALIZED';
  }> = [
    { id: 'sess-sample-cse-d2', dept: 'CSE', year: '2nd Year', section: 'A', classroomId: 'cls-cse-204', cameraId: 'cam-cse-204', subjectId: 'sub-cse-201', periodNumber: 1, periodLabel: 'Period 1', dayOffset: -3, startTime: '09:00', endTime: '09:50', status: 'FINALIZED' },
    { id: 'sess-sample-cse-d1-p1', dept: 'CSE', year: '2nd Year', section: 'A', classroomId: 'cls-cse-204', cameraId: 'cam-cse-204', subjectId: 'sub-cse-201', periodNumber: 1, periodLabel: 'Period 1', dayOffset: -1, startTime: '09:00', endTime: '09:50', status: 'FINALIZED' },
    { id: 'sess-sample-cse-d1-p4', dept: 'CSE', year: '2nd Year', section: 'A', classroomId: 'cls-cse-204', cameraId: 'cam-cse-204', subjectId: 'sub-cse-201', periodNumber: 4, periodLabel: 'Period 4', dayOffset: -1, startTime: '11:45', endTime: '12:35', status: 'FINALIZED' },
    { id: 'sess-sample-cse-d1-p7', dept: 'CSE', year: '2nd Year', section: 'A', classroomId: 'cls-cse-204', cameraId: 'cam-cse-204', subjectId: 'sub-cse-201', periodNumber: 7, periodLabel: 'Period 7', dayOffset: -1, startTime: '15:00', endTime: '15:50', status: 'FINALIZED' },
    { id: 'sess-sample-cse-live', dept: 'CSE', year: '2nd Year', section: 'A', classroomId: 'cls-cse-204', cameraId: 'cam-cse-204', subjectId: 'sub-cse-201', periodNumber: 2, periodLabel: 'Period 2', dayOffset: 0, startTime: '09:50', endTime: '', status: 'LIVE' },
    { id: 'sess-sample-it-d1', dept: 'IT', year: '1st Year', section: 'A', classroomId: 'cls-it-108', cameraId: 'cam-it-108', subjectId: 'sub-it-101', periodNumber: 1, periodLabel: 'Period 1', dayOffset: -1, startTime: '09:00', endTime: '09:50', status: 'FINALIZED' },
    { id: 'sess-sample-it-d0', dept: 'IT', year: '1st Year', section: 'A', classroomId: 'cls-it-108', cameraId: 'cam-it-108', subjectId: 'sub-it-101', periodNumber: 4, periodLabel: 'Period 4', dayOffset: 0, startTime: '11:45', endTime: '12:35', status: 'FINALIZED' },
    { id: 'sess-sample-aiml-d1', dept: 'AIML', year: '2nd Year', section: 'A', classroomId: 'cls-aiml-202', cameraId: 'cam-aiml-202', subjectId: 'sub-aiml-201', periodNumber: 1, periodLabel: 'Period 1', dayOffset: -1, startTime: '09:00', endTime: '09:50', status: 'FINALIZED' },
    { id: 'sess-sample-aiml-d0', dept: 'AIML', year: '2nd Year', section: 'A', classroomId: 'cls-aiml-202', cameraId: 'cam-aiml-202', subjectId: 'sub-aiml-201', periodNumber: 4, periodLabel: 'Period 4', dayOffset: 0, startTime: '11:45', endTime: '12:35', status: 'FINALIZED' },
    { id: 'sess-sample-aids-d0', dept: 'AIDS', year: '1st Year', section: 'A', classroomId: 'cls-aids-104', cameraId: 'cam-aids-104', subjectId: 'sub-aids-101', periodNumber: 1, periodLabel: 'Period 1', dayOffset: 0, startTime: '09:00', endTime: '09:50', status: 'FINALIZED' },
  ];

  for (const cfg of sampleSessionConfigs) {
    if (dbState.sessions.some((s) => s.id === cfg.id)) continue;
    const sub = dbState.subjects.find((x) => x.id === cfg.subjectId)!;
    const dateStr = todayDateStr(cfg.dayOffset);
    dbState.sessions.push({
      id: cfg.id,
      department: cfg.dept,
      academicYear: cfg.year,
      section: cfg.section,
      classroomId: cfg.classroomId,
      cameraId: cfg.cameraId,
      subjectId: sub.id,
      subjectName: `${sub.subjectCode} · ${sub.subjectName}`,
      facultyName: sub.facultyName,
      periodNumber: cfg.periodNumber,
      periodLabel: cfg.periodLabel,
      sessionDate: dateStr,
      startTime: cfg.startTime,
      endTime: cfg.endTime,
      status: cfg.status,
      finalizedAt: cfg.status === 'FINALIZED' ? now : null,
      finalizedBy: cfg.status === 'FINALIZED' ? actor.loginId : null,
      createdAt: now,
      updatedAt: now,
    });

    const cohort = dbState.students.filter(
      (st) => st.department === cfg.dept && st.academicYear === cfg.year && st.section === cfg.section,
    );

    cohort.forEach((stu, idx) => {
      if (cfg.status === 'LIVE' && idx >= 2) {
        // Leave remaining students unmarked in LIVE session so premature-absent rule is respected
        return;
      }
      let status: AttendanceStatus = 'PRESENT';
      if (idx === cohort.length - 1) status = 'ABSENT';
      else if (idx === cohort.length - 2 && cfg.dayOffset === 0) status = 'LATE';
      else if (cfg.status === 'LIVE' && idx === 1) status = 'PENDING_VERIFICATION';

      dbState.attendance.push({
        id: `${cfg.id}__${stu.id}`,
        sessionId: cfg.id,
        studentId: stu.id,
        registerNo: stu.registerNo,
        studentName: stu.fullName,
        department: cfg.dept,
        academicYear: stu.academicYear,
        section: stu.section,
        subjectId: sub.id,
        subjectName: `${sub.subjectCode} · ${sub.subjectName}`,
        periodNumber: cfg.periodNumber,
        periodLabel: cfg.periodLabel,
        sessionDate: dateStr,
        status,
        verificationSource: 'MANUAL',
        verificationStatus: status === 'PENDING_VERIFICATION' ? 'PENDING_REVIEW' : 'MANUAL_VERIFIED',
        confidence: null,
        livenessPassed: null,
        correctionReason: status === 'PENDING_VERIFICATION' ? 'Awaiting manual verification in sample live session' : null,
        recognitionTimestamp: null,
        markedAt: now,
        updatedAt: now,
        updatedBy: actor.loginId,
      });
    });
  }

  dbState.settings.sampleDataSeeded = true;
  dbState.settings.updatedAt = now;

  recordAuditLog({
    actor,
    department: null,
    action: 'SAMPLE_DATA_LOADED',
    targetType: 'INSTITUTION',
    targetId: dbState.settings.institutionCode,
    details: `Loaded ${sampleSpecs.length} sample students and ${sampleSessionConfigs.length} sample sessions for demonstration.`,
  });
  writeDbAtomic(dbState);
  return dbState;
}

export function clearSampleDemonstrationData(actor: AuthUser): SmartAttendDatabase {
  const isSampleStudent = (id: string) => id.startsWith('stu-sample-');
  const isSampleSession = (id: string) => id.startsWith('sess-sample-');

  dbState.students = dbState.students.filter((s) => !isSampleStudent(s.id));
  dbState.faceEnrollments = dbState.faceEnrollments.filter((f) => !isSampleStudent(f.studentId));
  dbState.sessions = dbState.sessions.filter((s) => !isSampleSession(s.id));
  dbState.attendance = dbState.attendance.filter((a) => !isSampleSession(a.sessionId) && !isSampleStudent(a.studentId));
  dbState.recognitionEvents = dbState.recognitionEvents.filter((e) => !isSampleSession(e.sessionId));
  dbState.settings.sampleDataSeeded = false;
  dbState.settings.updatedAt = new Date().toISOString();

  recordAuditLog({
    actor,
    department: null,
    action: 'SAMPLE_DATA_CLEARED',
    targetType: 'INSTITUTION',
    targetId: dbState.settings.institutionCode,
    details: 'Cleared sample demonstration students and sessions while preserving real institutional records.',
  });
  writeDbAtomic(dbState);
  return dbState;
}
