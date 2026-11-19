import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  adminResetHodPassword,
  authenticateUser,
  completePasswordReset,
  createHodAccount,
  getClassroomsForAdmin,
  getClassroomsForDepartment,
  getSandboxHints,
  getUserById,
  initiatePasswordReset,
  listHodAccounts,
  revokeSession,
  updateHodAccount,
  updateSelfProfile,
  verifySessionToken,
} from './server/authStore.ts';
import {
  clearSampleDemonstrationData,
  createClassSession,
  createHoliday,
  createStudent,
  createSubject,
  deleteHoliday,
  deleteTimetableOverride,
  deleteTimetablePeriod,
  finalizeClassSession,
  getWorkspaceBootstrap,
  importStudentsBatch,
  importStudentsCsv,
  loadSampleDemonstrationData,
  logRecognitionEvent,
  revokeFaceEnrollment,
  saveFaceEnrollment,
  syncDepartmentHodAssignment,
  updateInstitutionSettings,
  updateStudent,
  upsertAttendanceMark,
  upsertCamera,
  upsertClassroom,
  upsertDepartment,
  upsertTimetableOverride,
  upsertTimetablePeriod,
} from './server/dbStore.ts';
import type { AuthUser, DepartmentCode, UserRole } from './src/types/auth.ts';
import type {
  AcademicYear,
  AttendanceSource,
  AttendanceStatus,
  CameraSourceType,
  ClassroomStatus,
  DayOfWeek,
  LivenessStatus,
  RecognitionOutcome,
  SectionCode,
} from './src/types/smartattend.ts';

const PORT = 3000;
const SESSION_COOKIE_NAME = 'sa_session';

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!cookieHeader) return parsed;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      parsed[key] = decodeURIComponent(val);
    }
  }
  return parsed;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoStr = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return Boolean(
    req.secure ||
      (protoStr && protoStr.toLowerCase().includes('https')) ||
      process.env.NODE_ENV === 'production',
  );
}

function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  maxAgeMs: number,
  persistent: boolean,
): void {
  const isHttps = isHttpsRequest(req);
  const directives = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (persistent) {
    directives.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  }
  if (isHttps) {
    directives.push('Secure');
    directives.push('Partitioned');
  }
  res.setHeader('Set-Cookie', directives.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  const directives = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    directives.push('Secure');
    directives.push('Partitioned');
  }
  res.setHeader('Set-Cookie', directives.join('; '));
}

function extractSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  const user = getUserById(session.userId);
  if (!user || !user.active) {
    clearSessionCookie(req, res);
    res.status(401).json({ message: 'Session is no longer valid.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    if (req.authUser.role !== role) {
      res.status(403).json({ message: `Access restricted to ${role} accounts.` });
      return;
    }
    next();
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Serve local @vladmandic/face-api neural model weights + MediaPipe WASM & BlazeFace model offline without CDN failures
  const cvModelsDir = path.resolve(process.cwd(), 'node_modules/@vladmandic/face-api/model');
  app.use('/cv-models', express.static(cvModelsDir, { maxAge: '1d' }));

  const mediapipeWasmDir = path.resolve(process.cwd(), 'node_modules/@mediapipe/tasks-vision/wasm');
  app.use('/mediapipe-wasm', express.static(mediapipeWasmDir, { maxAge: '1d' }));

  const mediapipeModelsDir = path.resolve(process.cwd(), 'public/mediapipe-models');
  app.use('/mediapipe-models', express.static(mediapipeModelsDir, { maxAge: '1d' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'smartattend-platform' });
  });

  app.get('/api/auth/sandbox-accounts', (_req, res) => {
    const accounts = getSandboxHints();
    res.json({
      enabled: accounts.length > 0,
      accounts,
    });
  });

  app.get('/api/auth/session', (req, res) => {
    const token = extractSessionToken(req);
    const session = verifySessionToken(token);
    if (!session) {
      res.json({ authenticated: false, user: null, expiresAt: null });
      return;
    }
    const user = getUserById(session.userId);
    if (!user || !user.active) {
      clearSessionCookie(req, res);
      res.json({ authenticated: false, user: null, expiresAt: null });
      return;
    }
    res.json({
      authenticated: true,
      user,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { role, identifier, password, department, rememberMe } = req.body as {
      role?: UserRole;
      identifier?: string;
      password?: string;
      department?: DepartmentCode;
      rememberMe?: boolean;
    };

    if (role !== 'ADMINISTRATION' && role !== 'HOD') {
      res.status(400).json({ message: 'Invalid login role specified.' });
      return;
    }

    const result = authenticateUser({
      role,
      identifier: String(identifier ?? ''),
      password: String(password ?? ''),
      department,
      rememberMe: Boolean(rememberMe),
    });

    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    setSessionCookie(req, res, result.sessionToken, result.maxAgeMs, Boolean(rememberMe));
    res.json({
      authenticated: true,
      user: result.user,
      expiresAt: new Date(result.expiresAt).toISOString(),
      sessionToken: result.sessionToken,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractSessionToken(req);
    revokeSession(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { role, identifier, department } = req.body as {
      role?: UserRole;
      identifier?: string;
      department?: DepartmentCode;
    };

    if (role !== 'ADMINISTRATION' && role !== 'HOD') {
      res.status(400).json({ message: 'Invalid role selected.' });
      return;
    }

    const result = initiatePasswordReset({
      role,
      identifier: String(identifier ?? ''),
      department,
    });

    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    res.json({
      resetId: result.resetId,
      expiresAt: result.expiresAt,
      maskedDestination: result.maskedDestination,
      verificationHint: result.verificationHint,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { resetId, code, newPassword } = req.body as {
      resetId?: string;
      code?: string;
      newPassword?: string;
    };

    const result = completePasswordReset({
      resetId: String(resetId ?? ''),
      code: String(code ?? ''),
      newPassword: String(newPassword ?? ''),
    });

    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    res.json({ ok: true });
  });

  // Self-service profile update
  app.patch('/api/profile/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    const body = req.body as {
      fullName?: string;
      phone?: string;
      currentPassword?: string;
      newPassword?: string;
    };
    const result = updateSelfProfile(actor.id, body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ user: result.user });
  });

  // Unified Workspace Bootstrap (strictly scoped by role/department)
  app.get('/api/workspace/bootstrap', requireAuth, (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    const requestedDept = req.query.department ? String(req.query.department).toUpperCase() : null;
    if (actor.role === 'HOD' && requestedDept && requestedDept !== actor.department) {
      res.status(403).json({
        message: `Department isolation error: ${actor.department} HOD cannot access ${requestedDept}.`,
      });
      return;
    }
    res.json(getWorkspaceBootstrap(actor));
  });

  // Administration Overview & Settings
  app.get('/api/admin/overview', requireAuth, requireRole('ADMINISTRATION'), (_req, res) => {
    res.json({
      hodAccounts: listHodAccounts(),
      classrooms: getClassroomsForAdmin(),
    });
  });

  app.patch('/api/admin/settings', requireAuth, requireRole('ADMINISTRATION'), (req: AuthenticatedRequest, res) => {
    const updated = updateInstitutionSettings(req.authUser!, req.body);
    res.json({ settings: updated });
  });

  app.post('/api/admin/sample-data/load', requireAuth, requireRole('ADMINISTRATION'), (req: AuthenticatedRequest, res) => {
    loadSampleDemonstrationData(req.authUser!);
    res.json(getWorkspaceBootstrap(req.authUser!));
  });

  app.post('/api/admin/sample-data/clear', requireAuth, requireRole('ADMINISTRATION'), (req: AuthenticatedRequest, res) => {
    clearSampleDemonstrationData(req.authUser!);
    res.json(getWorkspaceBootstrap(req.authUser!));
  });

  // Departments (Admin only)
  app.post('/api/admin/departments', requireAuth, requireRole('ADMINISTRATION'), (req: AuthenticatedRequest, res) => {
    const result = upsertDepartment(req.authUser!, req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ department: result.department });
  });

  app.patch('/api/admin/departments/:id', requireAuth, requireRole('ADMINISTRATION'), (req: AuthenticatedRequest, res) => {
    const result = upsertDepartment(req.authUser!, { ...req.body, id: String(req.params.id) });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ department: result.department });
  });

  // HOD Management (Admin only)
  app.post('/api/admin/hod-accounts', requireAuth, requireRole('ADMINISTRATION'), (req, res) => {
    const body = req.body as {
      hodId?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      department?: DepartmentCode;
      temporaryPassword?: string;
      active?: boolean;
    };

    const result = createHodAccount({
      hodId: String(body.hodId ?? ''),
      fullName: String(body.fullName ?? ''),
      email: String(body.email ?? ''),
      phone: String(body.phone ?? ''),
      department: body.department as DepartmentCode,
      temporaryPassword: String(body.temporaryPassword ?? ''),
      active: body.active,
    });

    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    syncDepartmentHodAssignment(result.account);
    res.status(201).json({ account: result.account });
  });

  app.patch('/api/admin/hod-accounts/:id', requireAuth, requireRole('ADMINISTRATION'), (req, res) => {
    const { id } = req.params;
    const body = req.body as {
      active?: boolean;
      department?: DepartmentCode;
      fullName?: string;
      email?: string;
      phone?: string;
    };
    const result = updateHodAccount(String(id), body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    syncDepartmentHodAssignment(result.account);
    res.json({ account: result.account });
  });

  app.post('/api/admin/hod-accounts/:id/reset-password', requireAuth, requireRole('ADMINISTRATION'), (req, res) => {
    const result = adminResetHodPassword(String(req.params.id), String(req.body?.newPassword ?? ''));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ account: result.account });
  });

  // HOD Department Overview (Department Isolation Verified)
  app.get('/api/hod/department-overview', requireAuth, requireRole('HOD'), (req: AuthenticatedRequest, res) => {
    const user = req.authUser;
    if (!user || !user.department) {
      res.status(403).json({ message: 'No department assigned to this HOD account.' });
      return;
    }
    const requestedDept = req.query.department;
    if (requestedDept && String(requestedDept).toUpperCase() !== user.department) {
      res.status(403).json({
        message: `Access denied: ${user.department} HOD cannot query ${String(requestedDept)} records.`,
      });
      return;
    }
    res.json({
      department: user.department,
      classrooms: getClassroomsForDepartment(user.department),
      years: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    });
  });

  // Student Management & CSV Import
  app.post('/api/students', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = createStudent(req.authUser!, req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ student: result.student });
  });

  app.patch('/api/students/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = updateStudent(req.authUser!, String(req.params.id), req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ student: result.student });
  });

  app.post('/api/students/import-csv', requireAuth, (req: AuthenticatedRequest, res) => {
    const csvText = String(req.body?.csvText ?? '');
    const result = importStudentsCsv(req.authUser!, csvText);
    res.json(result);
  });

  app.post('/api/students/import-batch', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const result = importStudentsBatch(req.authUser!, rows);
    res.json(result);
  });

  app.patch('/api/hod/checkpoint-periods', requireAuth, (req: AuthenticatedRequest, res) => {
    const checkpointPeriods = Array.isArray(req.body?.checkpointPeriods)
      ? req.body.checkpointPeriods.map(Number)
      : undefined;
    const totalPeriodsPerDay =
      typeof req.body?.totalPeriodsPerDay === 'number' ? req.body.totalPeriodsPerDay : undefined;
    if (!checkpointPeriods || checkpointPeriods.length === 0) {
      res.status(400).json({ message: 'At least one checkpoint period number is required.' });
      return;
    }
    const settings = updateInstitutionSettings(req.authUser!, {
      fullDayCheckpointPeriods: checkpointPeriods,
      ...(totalPeriodsPerDay ? { totalPeriodsPerDay } : {}),
    });
    res.json({ settings });
  });

  // Consent-Based Biometric Face Enrollment & Revocation
  app.post('/api/face-enrollments', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = saveFaceEnrollment(req.authUser!, {
      studentId: String(req.body?.studentId ?? ''),
      consentGranted: Boolean(req.body?.consentGranted),
      descriptor: Array.isArray(req.body?.descriptor) ? req.body.descriptor : [],
      photoDataUrl: req.body?.photoDataUrl ?? undefined,
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ student: result.student, enrollment: result.enrollment });
  });

  app.delete('/api/face-enrollments/:studentId', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = revokeFaceEnrollment(req.authUser!, String(req.params.studentId));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ student: result.student });
  });

  // Classrooms, Cameras & Subjects
  app.post('/api/classrooms', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertClassroom(req.authUser!, {
      ...req.body,
      capacity: Number(req.body?.capacity ?? 60),
      academicYear: req.body?.academicYear as AcademicYear,
      section: req.body?.section as SectionCode,
      status: req.body?.status as ClassroomStatus,
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ classroom: result.classroom });
  });

  app.patch('/api/classrooms/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertClassroom(req.authUser!, {
      ...req.body,
      id: String(req.params.id),
      capacity: Number(req.body?.capacity ?? 60),
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ classroom: result.classroom });
  });

  app.post('/api/cameras', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertCamera(req.authUser!, {
      ...req.body,
      sourceType: (req.body?.sourceType ?? 'WEBCAM') as CameraSourceType,
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ camera: result.camera });
  });

  app.patch('/api/cameras/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertCamera(req.authUser!, {
      ...req.body,
      id: String(req.params.id),
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ camera: result.camera });
  });

  app.post('/api/subjects', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = createSubject(req.authUser!, req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ subject: result.subject });
  });

  // Timetable Management (Periods, Holidays, Overrides)
  app.post('/api/timetable/periods', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertTimetablePeriod(req.authUser!, {
      ...req.body,
      dayOfWeek: req.body?.dayOfWeek as DayOfWeek,
      academicYear: req.body?.academicYear as AcademicYear,
      section: req.body?.section as SectionCode,
      periodNumber: Number(req.body?.periodNumber ?? 1),
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ period: result.period });
  });

  app.patch('/api/timetable/periods/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertTimetablePeriod(req.authUser!, {
      ...req.body,
      id: String(req.params.id),
      dayOfWeek: req.body?.dayOfWeek as DayOfWeek,
      academicYear: req.body?.academicYear as AcademicYear,
      section: req.body?.section as SectionCode,
      periodNumber: Number(req.body?.periodNumber ?? 1),
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ period: result.period });
  });

  app.delete('/api/timetable/periods/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = deleteTimetablePeriod(req.authUser!, String(req.params.id));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/timetable/holidays', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = createHoliday(req.authUser!, req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ holiday: result.holiday });
  });

  app.delete('/api/timetable/holidays/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = deleteHoliday(req.authUser!, String(req.params.id));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/timetable/overrides', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = upsertTimetableOverride(req.authUser!, req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ override: result.override });
  });

  app.delete('/api/timetable/overrides/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = deleteTimetableOverride(req.authUser!, String(req.params.id));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ ok: true });
  });

  // Class Sessions & Attendance & Real CV Recognition Events
  app.post('/api/sessions', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = createClassSession(req.authUser!, req.body);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json({ session: result.session });
  });

  app.post('/api/sessions/:id/finalize', requireAuth, (req: AuthenticatedRequest, res) => {
    const result = finalizeClassSession(req.authUser!, String(req.params.id));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ session: result.session, newlyMarkedAbsent: result.newlyMarkedAbsent });
  });

  app.post('/api/attendance/mark', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.body?.demoMode === true) {
      res.status(400).json({
        message: 'Demo Video Mode detections cannot be saved as genuine classroom attendance records.',
      });
      return;
    }
    const result = upsertAttendanceMark(req.authUser!, {
      sessionId: String(req.body?.sessionId ?? ''),
      studentId: String(req.body?.studentId ?? ''),
      status: req.body?.status as AttendanceStatus,
      verificationSource: (req.body?.verificationSource ?? 'MANUAL') as AttendanceSource,
      confidence: req.body?.confidence ?? null,
      livenessPassed: req.body?.livenessPassed ?? null,
      correctionReason: req.body?.correctionReason ?? null,
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ record: result.record });
  });

  app.post('/api/recognition-events', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.body?.demoMode === true) {
      res.status(400).json({
        message: 'Demo Video Mode detections are excluded from persistent biometric attendance logs.',
      });
      return;
    }
    const result = logRecognitionEvent(req.authUser!, {
      sessionId: String(req.body?.sessionId ?? ''),
      cameraId: String(req.body?.cameraId ?? ''),
      matchedStudentId: req.body?.matchedStudentId ?? null,
      confidence: Number(req.body?.confidence ?? 0),
      livenessStatus: (req.body?.livenessStatus ?? 'UNCHECKED') as LivenessStatus,
      outcome: (req.body?.outcome ?? 'UNKNOWN') as RecognitionOutcome,
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(201).json(result);
  });

  // Server-Side Gemini API Report Advisory (NEVER used as biometric identifier)
  app.post('/api/ai/attendance-insights', requireAuth, async (req: AuthenticatedRequest, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        message: 'GEMINI_API_KEY is not configured in server environment secrets.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const summaryContext = JSON.stringify(req.body ?? {}).slice(0, 8000);
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are an institutional academic attendance advisor for SMARTATTEND. Analyze these verified aggregated attendance statistics and provide a concise, structured 4-bullet administrative action brief covering attendance risks, department/cohort trends, and follow-up recommendations for students below threshold. Do not invent numbers not present in the payload.\n\nMetrics JSON:\n${summaryContext}`,
      });
      res.json({
        insights: response.text ?? 'No insights generated.',
        model: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Failed to generate AI attendance insights.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SMARTATTEND server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SMARTATTEND server:', err);
  process.exit(1);
});
