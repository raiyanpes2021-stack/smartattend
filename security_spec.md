# SMARTATTEND Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: No collection or path may be read or written unless explicitly authorized.
2. **Verified Identity**: Write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin & HOD RBAC Separation**:
   - Administration access requires verified bootstrap admin email (`raiyanpes2021@gmail.com`) or membership in `/admins/{uid}`.
   - HOD access requires an active record in `/hods/{uid}` with `status == 'ACTIVE'` and strictly restricts reads/writes to matching `departmentCode`.
   - HODs cannot create or modify `/hods`, `/admins`, `/institutions`, or records in any department other than their assigned `departmentCode`.
4. **Immutable Ownership & Temporal Integrity**: `ownerUid == request.auth.uid`, `createdAt == request.time`, and `updatedAt == request.time`.
5. **Terminal Locking**: Once a `classSession` reaches `status == 'FINALIZED'`, HODs cannot re-open it; only Administration can override. `auditLogs` are strictly append-only (no update or delete).
6. **PII & Biometric Consent Isolation**: `students`, `hods`, and `faceEnrollments` are never readable via blanket `isSignedIn()` queries; access is restricted strictly to `isAdmin()` or matching department HOD (`isActiveHodForDept(resource.data.departmentCode)`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /students/stu-1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: `create /departments/ECE` with `email: 'raiyanpes2021@gmail.com'`, `email_verified: false` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Escalation**: `create /admins/attackerUid` by non-admin user -> `PERMISSION_DENIED`.
4. **HOD Cross-Department Read**: `CSE` HOD attempts `get /students/stu-it-1` (`departmentCode: 'IT'`) -> `PERMISSION_DENIED`.
5. **HOD Cross-Department Write**: `CSE` HOD attempts `create /attendance/att-1` with `departmentCode: 'AIML'` -> `PERMISSION_DENIED`.
6. **HOD Privilege Escalation (Create HOD)**: `CSE` HOD attempts `create /hods/new-hod` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection**: Admin sends `/students/stu-1` with extra ghost key `isSuperAdmin: true` -> `PERMISSION_DENIED` (blocked by `hasOnly()`).
8. **ID Poisoning (1.5KB Document ID)**: `create /students/${'a'.repeat(1500)}` -> `PERMISSION_DENIED` (blocked by `isValidId()`).
9. **Spoofed Timestamp**: Client sends `createdAt: '2020-01-01T00:00:00Z'` instead of server `request.time` -> `PERMISSION_DENIED`.
10. **Blanket List Scraping**: `CSE` HOD attempts `list /students` without `where('departmentCode', '==', 'CSE')` -> `PERMISSION_DENIED`.
11. **Finalized Session Tampering**: HOD attempts to change `status` of a `FINALIZED` `classSession` back to `LIVE` -> `PERMISSION_DENIED`.
12. **Audit Log Erasure**: Any user attempts `delete /auditLogs/log-1` or `update /auditLogs/log-1` -> `PERMISSION_DENIED`.
