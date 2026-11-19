import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuthUser,
  ClassroomNode,
  CreateHodPayload,
  DepartmentCode,
  SandboxCredentialHint,
  UserRole,
} from '../src/types/auth.ts';

interface StoredUserRecord {
  id: string;
  loginId: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  department: DepartmentCode | null;
  passwordHash: string;
  active: boolean;
  passwordCustomized?: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface StoredStoreData {
  users: StoredUserRecord[];
  classrooms: ClassroomNode[];
  sessionSecret?: string;
}

interface ActiveSessionRecord {
  sessionId: string;
  userId: string;
  role: UserRole;
  department: DepartmentCode | null;
  expiresAt: number;
}

interface PasswordResetRecord {
  resetId: string;
  userId: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'smartattend-auth.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'smartattend-sessions.json');

const activeSessions = new Map<string, ActiveSessionRecord>();
const activeResets = new Map<string, PasswordResetRecord>();
const sandboxCredentials = new Map<string, SandboxCredentialHint>();

function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = crypto.scryptSync(plainPassword, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function generatePassphrase(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const bytes = crypto.randomBytes(8);
  let out = 'SA';
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `${out}9`;
}

function createInitialClassrooms(): ClassroomNode[] {
  return [
    {
      roomCode: 'CSE-204',
      roomName: 'Room 204 · Smart Computing Lab',
      department: 'CSE',
      yearLevel: '2nd Year',
      capacity: 64,
      cameraStatus: 'Awaiting Hardware Binding',
    },
    {
      roomCode: 'CSE-301',
      roomName: 'Room 301 · Systems Lecture Hall',
      department: 'CSE',
      yearLevel: '3rd Year',
      capacity: 72,
      cameraStatus: 'Calibration Required',
    },
    {
      roomCode: 'IT-108',
      roomName: 'Room 108 · Network Architecture Studio',
      department: 'IT',
      yearLevel: '1st Year',
      capacity: 60,
      cameraStatus: 'Awaiting Hardware Binding',
    },
    {
      roomCode: 'IT-402',
      roomName: 'Room 402 · Enterprise Systems Seminar',
      department: 'IT',
      yearLevel: '4th Year',
      capacity: 56,
      cameraStatus: 'Awaiting Hardware Binding',
    },
    {
      roomCode: 'AIML-202',
      roomName: 'Room 202 · Neural Vision Studio',
      department: 'AIML',
      yearLevel: '2nd Year',
      capacity: 60,
      cameraStatus: 'Calibration Required',
    },
    {
      roomCode: 'AIML-305',
      roomName: 'Room 305 · Machine Intelligence Hall',
      department: 'AIML',
      yearLevel: '3rd Year',
      capacity: 68,
      cameraStatus: 'Awaiting Hardware Binding',
    },
    {
      roomCode: 'AIDS-104',
      roomName: 'Room 104 · Statistical Modeling Hall',
      department: 'AIDS',
      yearLevel: '1st Year',
      capacity: 64,
      cameraStatus: 'Awaiting Hardware Binding',
    },
    {
      roomCode: 'AIDS-401',
      roomName: 'Room 401 · Data Engineering Capstone',
      department: 'AIDS',
      yearLevel: '4th Year',
      capacity: 58,
      cameraStatus: 'Calibration Required',
    },
  ];
}

function writeStoreAtomic(data: StoredStoreData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, STORE_PATH);
}

function loadOrInitializeStore(): StoredStoreData {
  const isSandbox = process.env.DISABLE_SANDBOX_HINTS !== 'true';

  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as StoredStoreData;
      if (Array.isArray(parsed.users) && parsed.users.length > 0) {
        let changed = false;
        if (!parsed.sessionSecret || parsed.sessionSecret.length < 32) {
          parsed.sessionSecret = crypto.randomBytes(32).toString('hex');
          changed = true;
        }
        if (isSandbox) {
          for (const u of parsed.users) {
            if (!u.passwordCustomized) {
              const freshPass = generatePassphrase();
              u.passwordHash = hashPassword(freshPass);
              sandboxCredentials.set(u.id, {
                role: u.role,
                loginId: u.loginId,
                email: u.email,
                department: u.department,
                temporaryPassphrase: freshPass,
              });
              changed = true;
            }
          }
        }
        if (changed) {
          writeStoreAtomic(parsed);
        }
        return parsed;
      }
    } catch {
      // Re-initialize only if corrupt
    }
  }

  const now = new Date().toISOString();
  const seedConfigs: Array<{
    id: string;
    loginId: string;
    email: string;
    fullName: string;
    phone: string;
    role: UserRole;
    department: DepartmentCode | null;
    envOverride?: string;
  }> = [
    {
      id: 'usr-admin-01',
      loginId: 'ADMIN-001',
      email: 'admin@smartattend.edu',
      fullName: 'Dr. Arvind Narayanan',
      phone: '+91 98400 10001',
      role: 'ADMINISTRATION',
      department: null,
      envOverride: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    },
    {
      id: 'usr-hod-cse',
      loginId: 'HOD-CSE-01',
      email: 'hod.cse@smartattend.edu',
      fullName: 'Prof. Meenakshi Iyer',
      phone: '+91 98400 20101',
      role: 'HOD',
      department: 'CSE',
    },
    {
      id: 'usr-hod-it',
      loginId: 'HOD-IT-01',
      email: 'hod.it@smartattend.edu',
      fullName: 'Prof. Vikramaditya Rao',
      phone: '+91 98400 20202',
      role: 'HOD',
      department: 'IT',
    },
    {
      id: 'usr-hod-aiml',
      loginId: 'HOD-AIML-01',
      email: 'hod.aiml@smartattend.edu',
      fullName: 'Dr. Kavitha Subramanian',
      phone: '+91 98400 20303',
      role: 'HOD',
      department: 'AIML',
    },
    {
      id: 'usr-hod-aids',
      loginId: 'HOD-AIDS-01',
      email: 'hod.aids@smartattend.edu',
      fullName: 'Prof. Siddharth Kulkarni',
      phone: '+91 98400 20404',
      role: 'HOD',
      department: 'AIDS',
    },
  ];

  const users: StoredUserRecord[] = seedConfigs.map((cfg) => {
    const initialPassphrase =
      cfg.envOverride && cfg.envOverride.trim().length >= 8
        ? cfg.envOverride.trim()
        : generatePassphrase();

    if (isSandbox) {
      sandboxCredentials.set(cfg.id, {
        role: cfg.role,
        loginId: cfg.loginId,
        email: cfg.email,
        department: cfg.department,
        temporaryPassphrase: initialPassphrase,
      });
    }

    return {
      id: cfg.id,
      loginId: cfg.loginId,
      email: cfg.email,
      fullName: cfg.fullName,
      phone: cfg.phone,
      role: cfg.role,
      department: cfg.department,
      passwordHash: hashPassword(initialPassphrase),
      active: true,
      passwordCustomized: Boolean(cfg.envOverride && cfg.envOverride.trim().length >= 8),
      createdAt: now,
      lastLoginAt: null,
    };
  });

  const initialStore: StoredStoreData = {
    users,
    classrooms: createInitialClassrooms(),
    sessionSecret: crypto.randomBytes(32).toString('hex'),
  };

  writeStoreAtomic(initialStore);
  return initialStore;
}

const storeState: StoredStoreData = loadOrInitializeStore();

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : (storeState.sessionSecret ?? crypto.randomBytes(32).toString('hex'));

function loadPersistedSessions(): void {
  if (!fs.existsSync(SESSIONS_PATH)) return;
  try {
    const raw = fs.readFileSync(SESSIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ActiveSessionRecord[];
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    for (const rec of parsed) {
      if (rec && rec.sessionId && rec.userId && rec.expiresAt > now) {
        activeSessions.set(rec.sessionId, rec);
      }
    }
  } catch {
    // Ignore corrupt session cache
  }
}

function persistSessions(): void {
  try {
    const now = Date.now();
    const list: ActiveSessionRecord[] = [];
    for (const [id, rec] of activeSessions.entries()) {
      if (rec.expiresAt > now) {
        list.push(rec);
      } else {
        activeSessions.delete(id);
      }
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempPath = `${SESSIONS_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(list), { mode: 0o600 });
    fs.renameSync(tempPath, SESSIONS_PATH);
  } catch {
    // Non-fatal
  }
}

loadPersistedSessions();

export function sanitizeUser(record: StoredUserRecord): AuthUser {
  return {
    id: record.id,
    loginId: record.loginId,
    email: record.email,
    fullName: record.fullName,
    phone: record.phone ?? '',
    role: record.role,
    department: record.department,
    active: record.active,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
  };
}

export function isValidDepartment(dept: unknown): dept is DepartmentCode {
  return typeof dept === 'string' && /^[A-Z0-9_-]{2,16}$/.test(dept.trim().toUpperCase());
}

export function getSandboxHints(): SandboxCredentialHint[] {
  if (process.env.DISABLE_SANDBOX_HINTS === 'true') {
    return [];
  }
  return Array.from(sandboxCredentials.values());
}

export function signSessionToken(sessionId: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('hex');
  return `${sessionId}.${sig}`;
}

export function verifySessionToken(token: string | undefined): ActiveSessionRecord | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  if (!sessionId || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(sessionId)
    .digest('hex');

  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const session = activeSessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(sessionId);
    persistSessions();
    return null;
  }
  return session;
}

export function getUserById(userId: string): AuthUser | null {
  const found = storeState.users.find((u) => u.id === userId);
  return found ? sanitizeUser(found) : null;
}

export function authenticateUser(params: {
  role: UserRole;
  identifier: string;
  password: string;
  department?: DepartmentCode;
  rememberMe?: boolean;
}):
  | {
      ok: true;
      user: AuthUser;
      sessionToken: string;
      expiresAt: number;
      maxAgeMs: number;
    }
  | {
      ok: false;
      status: number;
      message: string;
    } {
  const normalizedId = params.identifier.trim().toLowerCase();
  if (!normalizedId || !params.password) {
    return {
      ok: false,
      status: 400,
      message: 'Credentials are required to authenticate.',
    };
  }

  const normalizedDept = params.department?.trim().toUpperCase();
  if (params.role === 'HOD' && !isValidDepartment(normalizedDept)) {
    return {
      ok: false,
      status: 400,
      message: 'Please select a valid department (CSE, IT, AIML, or AIDS).',
    };
  }

  const user = storeState.users.find(
    (u) =>
      u.loginId.toLowerCase() === normalizedId || u.email.toLowerCase() === normalizedId,
  );

  if (!user || !verifyPassword(params.password, user.passwordHash)) {
    return {
      ok: false,
      status: 401,
      message: 'Invalid institutional ID or password.',
    };
  }

  if (!user.active) {
    return {
      ok: false,
      status: 403,
      message: 'This institutional account is currently suspended. Contact Administration.',
    };
  }

  if (user.role !== params.role) {
    return {
      ok: false,
      status: 403,
      message:
        params.role === 'ADMINISTRATION'
          ? 'HOD accounts cannot authenticate through the Administration portal.'
          : 'Administration accounts must sign in through the Administration portal.',
    };
  }

  if (params.role === 'HOD' && user.department !== normalizedDept) {
    return {
      ok: false,
      status: 403,
      message: `Department access denied. ${user.loginId} is assigned to ${user.department} and cannot access ${normalizedDept}.`,
    };
  }

  user.lastLoginAt = new Date().toISOString();
  writeStoreAtomic(storeState);

  const maxAgeMs = params.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const expiresAt = Date.now() + maxAgeMs;
  const sessionId = crypto.randomBytes(24).toString('hex');

  activeSessions.set(sessionId, {
    sessionId,
    userId: user.id,
    role: user.role,
    department: user.department,
    expiresAt,
  });
  persistSessions();

  return {
    ok: true,
    user: sanitizeUser(user),
    sessionToken: signSessionToken(sessionId),
    expiresAt,
    maxAgeMs,
  };
}

export function revokeSession(token: string | undefined): void {
  const session = verifySessionToken(token);
  if (session) {
    activeSessions.delete(session.sessionId);
    persistSessions();
  }
}

export function initiatePasswordReset(params: {
  role: UserRole;
  identifier: string;
  department?: DepartmentCode;
}):
  | {
      ok: true;
      resetId: string;
      expiresAt: string;
      maskedDestination: string;
      verificationHint?: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    } {
  const normalizedId = params.identifier.trim().toLowerCase();
  if (!normalizedId) {
    return {
      ok: false,
      status: 400,
      message: 'Enter your institutional ID or email address first.',
    };
  }

  const normalizedDept = params.department?.trim().toUpperCase();
  if (params.role === 'HOD' && !isValidDepartment(normalizedDept)) {
    return {
      ok: false,
      status: 400,
      message: 'Select your assigned department before requesting a password reset.',
    };
  }

  const user = storeState.users.find(
    (u) =>
      u.loginId.toLowerCase() === normalizedId || u.email.toLowerCase() === normalizedId,
  );

  if (!user || user.role !== params.role) {
    return {
      ok: false,
      status: 404,
      message: 'No matching active institutional account was found.',
    };
  }

  if (params.role === 'HOD' && user.department !== normalizedDept) {
    return {
      ok: false,
      status: 403,
      message: `Department mismatch: ${user.loginId} is not registered under ${normalizedDept}.`,
    };
  }

  const code = String(crypto.randomInt(100000, 999999));
  const resetId = crypto.randomBytes(16).toString('hex');
  const expiresMs = Date.now() + 10 * 60 * 1000;

  activeResets.set(resetId, {
    resetId,
    userId: user.id,
    codeHash: hashPassword(code),
    expiresAt: expiresMs,
    attempts: 0,
  });

  const [localPart, domainPart] = user.email.split('@');
  const maskedLocal =
    localPart.length <= 2
      ? `${localPart[0] ?? '*'}*`
      : `${localPart.slice(0, 2)}${'*'.repeat(Math.min(localPart.length - 2, 5))}`;

  return {
    ok: true,
    resetId,
    expiresAt: new Date(expiresMs).toISOString(),
    maskedDestination: `${maskedLocal}@${domainPart ?? 'smartattend.edu'}`,
    verificationHint: !process.env.SMTP_HOST ? code : undefined,
  };
}

export function completePasswordReset(params: {
  resetId: string;
  code: string;
  newPassword: string;
}):
  | { ok: true }
  | { ok: false; status: number; message: string } {
  const record = activeResets.get(params.resetId);
  if (!record) {
    return {
      ok: false,
      status: 400,
      message: 'Reset session expired or invalid. Request a new verification code.',
    };
  }

  if (Date.now() > record.expiresAt) {
    activeResets.delete(params.resetId);
    return {
      ok: false,
      status: 400,
      message: 'Verification code has expired. Request a new one.',
    };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    activeResets.delete(params.resetId);
    return {
      ok: false,
      status: 429,
      message: 'Too many invalid attempts. Request a new verification code.',
    };
  }

  if (!verifyPassword(params.code.trim(), record.codeHash)) {
    return {
      ok: false,
      status: 400,
      message: 'Incorrect verification code.',
    };
  }

  if (params.newPassword.length < 8 || !/[A-Za-z]/.test(params.newPassword) || !/\d/.test(params.newPassword)) {
    return {
      ok: false,
      status: 400,
      message: 'New password must be at least 8 characters and include letters and numbers.',
    };
  }

  const user = storeState.users.find((u) => u.id === record.userId);
  if (!user) {
    return {
      ok: false,
      status: 404,
      message: 'Account not found.',
    };
  }

  user.passwordHash = hashPassword(params.newPassword);
  user.passwordCustomized = true;
  writeStoreAtomic(storeState);
  activeResets.delete(params.resetId);

  const hint = sandboxCredentials.get(user.id);
  if (hint) {
    sandboxCredentials.set(user.id, {
      ...hint,
      temporaryPassphrase: params.newPassword,
    });
  }

  return { ok: true };
}

export function listHodAccounts(): AuthUser[] {
  return storeState.users
    .filter((u) => u.role === 'HOD')
    .map(sanitizeUser);
}

export function createHodAccount(payload: CreateHodPayload):
  | { ok: true; account: AuthUser }
  | { ok: false; status: number; message: string } {
  const hodId = payload.hodId.trim().toUpperCase();
  const fullName = payload.fullName.trim();
  const email = payload.email.trim().toLowerCase();
  const phone = (payload.phone ?? '').trim();
  const department = payload.department?.trim().toUpperCase();

  if (!hodId || !fullName || !email || !isValidDepartment(department)) {
    return {
      ok: false,
      status: 400,
      message: 'HOD ID, full name, email, and a valid department are required.',
    };
  }

  if (
    payload.temporaryPassword.length < 8 ||
    !/[A-Za-z]/.test(payload.temporaryPassword) ||
    !/\d/.test(payload.temporaryPassword)
  ) {
    return {
      ok: false,
      status: 400,
      message: 'Temporary password must be at least 8 characters with letters and numbers.',
    };
  }

  const duplicate = storeState.users.find(
    (u) => u.loginId.toUpperCase() === hodId || u.email.toLowerCase() === email,
  );
  if (duplicate) {
    return {
      ok: false,
      status: 409,
      message: 'An account with that HOD ID or email already exists.',
    };
  }

  const record: StoredUserRecord = {
    id: `usr-hod-${crypto.randomBytes(4).toString('hex')}`,
    loginId: hodId,
    email,
    fullName,
    phone,
    role: 'HOD',
    department,
    passwordHash: hashPassword(payload.temporaryPassword),
    active: payload.active !== false,
    passwordCustomized: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  storeState.users.push(record);
  writeStoreAtomic(storeState);

  if (process.env.DISABLE_SANDBOX_HINTS !== 'true') {
    sandboxCredentials.set(record.id, {
      role: 'HOD',
      loginId: record.loginId,
      email: record.email,
      department: record.department,
      temporaryPassphrase: payload.temporaryPassword,
    });
  }

  return { ok: true, account: sanitizeUser(record) };
}

export function updateHodAccount(
  id: string,
  updates: {
    active?: boolean;
    department?: DepartmentCode;
    fullName?: string;
    email?: string;
    phone?: string;
  },
):
  | { ok: true; account: AuthUser }
  | { ok: false; status: number; message: string } {
  const user = storeState.users.find((u) => u.id === id && u.role === 'HOD');
  if (!user) {
    return { ok: false, status: 404, message: 'HOD account not found.' };
  }

  if (typeof updates.active === 'boolean') {
    user.active = updates.active;
  }

  if (typeof updates.fullName === 'string' && updates.fullName.trim().length >= 2) {
    user.fullName = updates.fullName.trim();
  }

  if (typeof updates.email === 'string' && updates.email.includes('@')) {
    user.email = updates.email.trim().toLowerCase();
  }

  if (typeof updates.phone === 'string') {
    user.phone = updates.phone.trim();
  }

  if (updates.department !== undefined) {
    const normalized = updates.department.trim().toUpperCase();
    if (!isValidDepartment(normalized)) {
      return { ok: false, status: 400, message: 'Invalid department selection.' };
    }
    user.department = normalized;
    const hint = sandboxCredentials.get(user.id);
    if (hint) {
      sandboxCredentials.set(user.id, { ...hint, department: normalized });
    }
  }

  writeStoreAtomic(storeState);
  return { ok: true, account: sanitizeUser(user) };
}

export function adminResetHodPassword(
  id: string,
  newPassword: string,
):
  | { ok: true; account: AuthUser }
  | { ok: false; status: number; message: string } {
  const user = storeState.users.find((u) => u.id === id && u.role === 'HOD');
  if (!user) {
    return { ok: false, status: 404, message: 'HOD account not found.' };
  }
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return {
      ok: false,
      status: 400,
      message: 'New password must be at least 8 characters and include letters and numbers.',
    };
  }
  user.passwordHash = hashPassword(newPassword);
  user.passwordCustomized = true;
  writeStoreAtomic(storeState);

  const hint = sandboxCredentials.get(user.id);
  if (hint) {
    sandboxCredentials.set(user.id, { ...hint, temporaryPassphrase: newPassword });
  }
  return { ok: true, account: sanitizeUser(user) };
}

export function updateSelfProfile(
  userId: string,
  updates: { fullName?: string; phone?: string; currentPassword?: string; newPassword?: string },
):
  | { ok: true; user: AuthUser }
  | { ok: false; status: number; message: string } {
  const user = storeState.users.find((u) => u.id === userId);
  if (!user) {
    return { ok: false, status: 404, message: 'User account not found.' };
  }

  if (typeof updates.fullName === 'string' && updates.fullName.trim().length >= 2) {
    user.fullName = updates.fullName.trim();
  }
  if (typeof updates.phone === 'string') {
    user.phone = updates.phone.trim();
  }
  if (updates.newPassword) {
    if (!updates.currentPassword || !verifyPassword(updates.currentPassword, user.passwordHash)) {
      return { ok: false, status: 400, message: 'Current password is incorrect.' };
    }
    if (updates.newPassword.length < 8 || !/[A-Za-z]/.test(updates.newPassword) || !/\d/.test(updates.newPassword)) {
      return {
        ok: false,
        status: 400,
        message: 'New password must be at least 8 characters with letters and numbers.',
      };
    }
    user.passwordHash = hashPassword(updates.newPassword);
    user.passwordCustomized = true;
  }

  writeStoreAtomic(storeState);
  return { ok: true, user: sanitizeUser(user) };
}

export function getClassroomsForAdmin(): ClassroomNode[] {
  return storeState.classrooms;
}

export function getClassroomsForDepartment(department: DepartmentCode): ClassroomNode[] {
  return storeState.classrooms.filter((c) => c.department === department);
}
