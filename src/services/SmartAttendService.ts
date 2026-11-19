import {
  AuthApiError,
  clearStoredSessionToken,
  getStoredSessionToken,
} from './AuthenticationService';
import type { AuthUser, CreateHodPayload, DepartmentCode } from '../types/auth';
import type {
  AcademicYear,
  AttendanceRecord,
  AttendanceSource,
  AttendanceStatus,
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
  StudentRecord,
  SubjectRecord,
  TimetableHolidayRecord,
  TimetableOverrideRecord,
  TimetablePeriodRecord,
  WorkspaceBootstrapData,
} from '../types/smartattend';

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredSessionToken();
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSessionToken();
    }
    throw new AuthApiError(
      data.message || `Request failed (${response.status})`,
      response.status,
    );
  }
  return data;
}

export const SmartAttendService = {
  getBootstrap(department?: DepartmentCode): Promise<WorkspaceBootstrapData> {
    const query = department ? `?department=${encodeURIComponent(department)}` : '';
    return apiRequest<WorkspaceBootstrapData>(`/api/workspace/bootstrap${query}`, {
      method: 'GET',
    });
  },

  updateMyProfile(payload: {
    fullName?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ user: AuthUser }> {
    return apiRequest<{ user: AuthUser }>('/api/profile/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateSettings(patch: Partial<InstitutionSettings>): Promise<{ settings: InstitutionSettings }> {
    return apiRequest<{ settings: InstitutionSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  loadSampleData(): Promise<WorkspaceBootstrapData> {
    return apiRequest<WorkspaceBootstrapData>('/api/admin/sample-data/load', {
      method: 'POST',
    });
  },

  clearSampleData(): Promise<WorkspaceBootstrapData> {
    return apiRequest<WorkspaceBootstrapData>('/api/admin/sample-data/clear', {
      method: 'POST',
    });
  },

  upsertDepartment(payload: {
    id?: string;
    code: string;
    name: string;
    description?: string;
    hodId?: string | null;
    active?: boolean;
  }): Promise<{ department: DepartmentRecord }> {
    const url = payload.id
      ? `/api/admin/departments/${encodeURIComponent(payload.id)}`
      : '/api/admin/departments';
    return apiRequest<{ department: DepartmentRecord }>(url, {
      method: payload.id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
  },

  createHod(payload: CreateHodPayload): Promise<{ account: AuthUser }> {
    return apiRequest<{ account: AuthUser }>('/api/admin/hod-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateHod(
    id: string,
    updates: {
      active?: boolean;
      department?: DepartmentCode;
      fullName?: string;
      email?: string;
      phone?: string;
    },
  ): Promise<{ account: AuthUser }> {
    return apiRequest<{ account: AuthUser }>(`/api/admin/hod-accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  resetHodPassword(id: string, newPassword: string): Promise<{ account: AuthUser }> {
    return apiRequest<{ account: AuthUser }>(
      `/api/admin/hod-accounts/${encodeURIComponent(id)}/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      },
    );
  },

  createStudent(payload: Partial<StudentRecord>): Promise<{ student: StudentRecord }> {
    return apiRequest<{ student: StudentRecord }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStudent(id: string, patch: Partial<StudentRecord>): Promise<{ student: StudentRecord }> {
    return apiRequest<{ student: StudentRecord }>(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  importStudentsCsv(csvText: string): Promise<{
    ok: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    students: StudentRecord[];
  }> {
    return apiRequest('/api/students/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csvText }),
    });
  },

  importStudentsBatch(
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
  ): Promise<{
    ok: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    students: StudentRecord[];
  }> {
    return apiRequest('/api/students/import-batch', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  updateCheckpointPeriods(
    checkpointPeriods: number[],
    totalPeriodsPerDay?: number,
  ): Promise<{ settings: InstitutionSettings }> {
    return apiRequest('/api/hod/checkpoint-periods', {
      method: 'PATCH',
      body: JSON.stringify({ checkpointPeriods, totalPeriodsPerDay }),
    });
  },

  saveFaceEnrollment(payload: {
    studentId: string;
    consentGranted: boolean;
    descriptor: number[];
    photoDataUrl?: string | null;
  }): Promise<{ student: StudentRecord; enrollment: FaceEnrollmentRecord }> {
    return apiRequest('/api/face-enrollments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  revokeFaceEnrollment(studentId: string): Promise<{ student: StudentRecord }> {
    return apiRequest(`/api/face-enrollments/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    });
  },

  upsertClassroom(payload: {
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
  }): Promise<{ classroom: ClassroomRecord }> {
    const url = payload.id
      ? `/api/classrooms/${encodeURIComponent(payload.id)}`
      : '/api/classrooms';
    return apiRequest<{ classroom: ClassroomRecord }>(url, {
      method: payload.id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
  },

  upsertCamera(payload: {
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
  }): Promise<{ camera: CameraRecord }> {
    const url = payload.id ? `/api/cameras/${encodeURIComponent(payload.id)}` : '/api/cameras';
    return apiRequest<{ camera: CameraRecord }>(url, {
      method: payload.id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
  },

  createSubject(payload: {
    subjectCode: string;
    subjectName: string;
    department: DepartmentCode;
    academicYear: AcademicYear;
    facultyName: string;
    credits?: number;
  }): Promise<{ subject: SubjectRecord }> {
    return apiRequest<{ subject: SubjectRecord }>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  upsertTimetablePeriod(payload: {
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
  }): Promise<{ period: TimetablePeriodRecord }> {
    const url = payload.id
      ? `/api/timetable/periods/${encodeURIComponent(payload.id)}`
      : '/api/timetable/periods';
    return apiRequest<{ period: TimetablePeriodRecord }>(url, {
      method: payload.id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteTimetablePeriod(id: string): Promise<{ ok: boolean }> {
    return apiRequest(`/api/timetable/periods/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  createHoliday(payload: {
    date: string;
    title: string;
    department?: string;
    type?: 'HOLIDAY' | 'CANCELLED_DAY' | 'SPECIAL_EVENT';
  }): Promise<{ holiday: TimetableHolidayRecord }> {
    return apiRequest('/api/timetable/holidays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteHoliday(id: string): Promise<{ ok: boolean }> {
    return apiRequest(`/api/timetable/holidays/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  upsertTimetableOverride(payload: {
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
  }): Promise<{ override: TimetableOverrideRecord }> {
    return apiRequest('/api/timetable/overrides', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteTimetableOverride(id: string): Promise<{ ok: boolean }> {
    return apiRequest(`/api/timetable/overrides/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  createSession(payload: {
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
  }): Promise<{ session: ClassSessionRecord }> {
    return apiRequest<{ session: ClassSessionRecord }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  finalizeSession(sessionId: string): Promise<{
    session: ClassSessionRecord;
    newlyMarkedAbsent: number;
  }> {
    return apiRequest(`/api/sessions/${encodeURIComponent(sessionId)}/finalize`, {
      method: 'POST',
    });
  },

  markAttendance(payload: {
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    verificationSource: AttendanceSource;
    confidence?: number | null;
    livenessPassed?: boolean | null;
    correctionReason?: string | null;
  }): Promise<{ record: AttendanceRecord }> {
    return apiRequest<{ record: AttendanceRecord }>('/api/attendance/mark', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logRecognitionEvent(payload: {
    sessionId: string;
    cameraId: string;
    matchedStudentId: string | null;
    confidence: number;
    livenessStatus: LivenessStatus;
    outcome: RecognitionOutcome;
  }): Promise<{
    ok: boolean;
    event: RecognitionEventRecord;
    attendanceRecord?: AttendanceRecord;
  }> {
    return apiRequest('/api/recognition-events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateAiInsights(summaryPayload: unknown): Promise<{
    insights: string;
    model: string;
    generatedAt: string;
  }> {
    return apiRequest('/api/ai/attendance-insights', {
      method: 'POST',
      body: JSON.stringify(summaryPayload),
    });
  },
};
