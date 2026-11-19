import type {
  AuthUser,
  ClassroomNode,
  CreateHodPayload,
  DepartmentCode,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  ResetPasswordPayload,
  SandboxCredentialHint,
  SessionState,
} from '../types/auth';

const SESSION_TOKEN_KEY = 'smartattend_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return (
      window.sessionStorage.getItem(SESSION_TOKEN_KEY) ||
      window.localStorage.getItem(SESSION_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string, rememberMe: boolean): void {
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    if (rememberMe) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota / restricted storage errors
  }
}

export function clearStoredSessionToken(): void {
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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
    if (response.status === 401 && url !== '/api/auth/login') {
      clearStoredSessionToken();
    }
    throw new AuthApiError(
      data.message || `Request failed with status ${response.status}`,
      response.status,
    );
  }
  return data;
}

export const AuthenticationService = {
  async getSession(): Promise<SessionState> {
    const session = await requestJson<SessionState>('/api/auth/session', { method: 'GET' });
    if (!session.authenticated) {
      clearStoredSessionToken();
    }
    return session;
  },

  async login(payload: LoginPayload): Promise<SessionState> {
    const session = await requestJson<SessionState>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (session.authenticated && session.sessionToken) {
      setStoredSessionToken(session.sessionToken, Boolean(payload.rememberMe ?? true));
    }
    return session;
  },

  async logout(): Promise<{ ok: boolean }> {
    try {
      return await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      clearStoredSessionToken();
    }
  },

  initiatePasswordReset(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
    return requestJson<ForgotPasswordResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  completePasswordReset(payload: ResetPasswordPayload): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getSandboxAccounts(): Promise<{ enabled: boolean; accounts: SandboxCredentialHint[] }> {
    return requestJson<{ enabled: boolean; accounts: SandboxCredentialHint[] }>(
      '/api/auth/sandbox-accounts',
      { method: 'GET' },
    );
  },

  getAdminOverview(): Promise<{ hodAccounts: AuthUser[]; classrooms: ClassroomNode[] }> {
    return requestJson<{ hodAccounts: AuthUser[]; classrooms: ClassroomNode[] }>(
      '/api/admin/overview',
      { method: 'GET' },
    );
  },

  createHodAccount(payload: CreateHodPayload): Promise<{ account: AuthUser }> {
    return requestJson<{ account: AuthUser }>('/api/admin/hod-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateHodAccount(
    id: string,
    updates: { active?: boolean; department?: DepartmentCode },
  ): Promise<{ account: AuthUser }> {
    return requestJson<{ account: AuthUser }>(`/api/admin/hod-accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  getHodOverview(department: DepartmentCode): Promise<{
    department: DepartmentCode;
    classrooms: ClassroomNode[];
    years: readonly string[];
  }> {
    return requestJson<{
      department: DepartmentCode;
      classrooms: ClassroomNode[];
      years: readonly string[];
    }>(`/api/hod/department-overview?department=${encodeURIComponent(department)}`, {
      method: 'GET',
    });
  },
};
