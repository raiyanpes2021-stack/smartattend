/**
 * Firestore Security Rules Test Matrix (Dirty Dozen Adversarial Verification)
 * Compatible with @firebase/rules-unit-testing when run against Firestore Emulator.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actor: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_TESTS: readonly SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated student read',
    actor: 'anonymous',
    operation: 'get',
    path: 'students/stu-cse-01',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email admin spoof',
    actor: 'email=raiyanpes2021@gmail.com,email_verified=false',
    operation: 'create',
    path: 'departments/dept-ece',
    payload: { code: 'ECE', name: 'Electronics', active: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-assigned admin escalation',
    actor: 'uid=rogue-user,email_verified=true',
    operation: 'create',
    path: 'admins/rogue-user',
    payload: { email: 'rogue@example.com', loginId: 'ROGUE', fullName: 'Rogue' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'HOD cross-department student read (CSE -> IT)',
    actor: 'hod(CSE)',
    operation: 'get',
    path: 'students/stu-it-01',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'HOD cross-department attendance write (CSE -> AIML)',
    actor: 'hod(CSE)',
    operation: 'create',
    path: 'attendance/sess-1__stu-1',
    payload: {
      sessionId: 'sess-1',
      studentId: 'stu-1',
      departmentCode: 'AIML',
      status: 'PRESENT',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'HOD privilege escalation creating HOD account',
    actor: 'hod(CSE)',
    operation: 'create',
    path: 'hods/hod-fake',
    payload: { loginId: 'HOD-FAKE', departmentCode: 'IT', status: 'ACTIVE' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow ghost field injection on student update',
    actor: 'admin',
    operation: 'create',
    path: 'students/stu-ghost',
    payload: { registerNo: 'REG01', departmentCode: 'CSE', isSuperAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID poisoning exceeding 128 characters',
    actor: 'admin',
    operation: 'create',
    path: `students/${'x'.repeat(200)}`,
    payload: { registerNo: 'REG02', departmentCode: 'CSE' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Spoofed client timestamp on session create',
    actor: 'admin',
    operation: 'create',
    path: 'classSessions/sess-spoof',
    payload: { departmentCode: 'CSE', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'HOD un-scoped student collection list',
    actor: 'hod(CSE)',
    operation: 'list',
    path: 'students',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'HOD re-opening finalized session',
    actor: 'hod(CSE)',
    operation: 'update',
    path: 'classSessions/sess-finalized',
    payload: { status: 'LIVE' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Audit log deletion attempt',
    actor: 'admin',
    operation: 'delete',
    path: 'auditLogs/log-1',
    expected: 'PERMISSION_DENIED',
  },
];
