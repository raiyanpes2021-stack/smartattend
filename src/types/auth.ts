export type UserRole = 'ADMINISTRATION' | 'HOD';

export type DepartmentCode = 'CSE' | 'IT' | 'AIML' | 'AIDS' | string;

export const DEPARTMENTS: readonly {
  code: 'CSE' | 'IT' | 'AIML' | 'AIDS';
  label: string;
  fullName: string;
}[] = [
  {
    code: 'CSE',
    label: 'CSE',
    fullName: 'Computer Science and Engineering',
  },
  {
    code: 'IT',
    label: 'IT',
    fullName: 'Information Technology',
  },
  {
    code: 'AIML',
    label: 'AIML',
    fullName: 'Artificial Intelligence & Machine Learning',
  },
  {
    code: 'AIDS',
    label: 'AIDS',
    fullName: 'Artificial Intelligence & Data Science',
  },
];

export interface AuthUser {
  id: string;
  loginId: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  department: DepartmentCode | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SessionState {
  authenticated: boolean;
  user: AuthUser | null;
  expiresAt: string | null;
  sessionToken?: string;
}

export interface LoginPayload {
  role: UserRole;
  identifier: string;
  password: string;
  department?: DepartmentCode;
  rememberMe?: boolean;
}

export interface ForgotPasswordPayload {
  role: UserRole;
  identifier: string;
  department?: DepartmentCode;
}

export interface ForgotPasswordResponse {
  resetId: string;
  expiresAt: string;
  maskedDestination: string;
  verificationHint?: string;
}

export interface ResetPasswordPayload {
  resetId: string;
  code: string;
  newPassword: string;
}

export interface CreateHodPayload {
  hodId: string;
  fullName: string;
  email: string;
  phone?: string;
  department: DepartmentCode;
  temporaryPassword: string;
  active?: boolean;
}

export interface ClassroomNode {
  roomCode: string;
  roomName: string;
  department: DepartmentCode;
  yearLevel: '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
  capacity: number;
  cameraStatus: 'Awaiting Hardware Binding' | 'Calibration Required' | 'Active' | 'Offline';
}

export interface SandboxCredentialHint {
  role: UserRole;
  loginId: string;
  email: string;
  department: DepartmentCode | null;
  temporaryPassphrase: string;
}
