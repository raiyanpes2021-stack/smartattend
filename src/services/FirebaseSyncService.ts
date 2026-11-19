import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type FieldValue,
  type Timestamp,
  type WriteBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type { WorkspaceBootstrapData } from '../types/smartattend';

function safeId(raw: string, minLen = 1, maxLen = 120): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen) || 'id';
  return cleaned.length < minLen ? cleaned.padEnd(minLen, '0') : cleaned;
}

function safeDeptCode(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .slice(0, 16);
  if (cleaned.length >= 2) return cleaned;
  return (cleaned || 'GEN').padEnd(2, 'X');
}

function safeEmail(raw: string, fallbackPrefix: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 5 && trimmed.length <= 160 && trimmed.includes('@')) {
    return trimmed;
  }
  return `${safeId(fallbackPrefix, 2, 40).toLowerCase()}@smartattend.edu`;
}

export interface FirebaseSyncSummary {
  syncedAt: string;
  collectionsSynced: number;
  documentsWritten: number;
}

interface ExistingDocMeta {
  createdAt?: Timestamp | FieldValue;
  markedAt?: Timestamp | FieldValue;
  ownerUid?: string;
}

async function fetchExistingMetaMap(
  collectionName: string,
  deptScope: string | null,
): Promise<Map<string, ExistingDocMeta>> {
  const map = new Map<string, ExistingDocMeta>();
  try {
    const colRef = collection(db, collectionName);
    const snap = deptScope
      ? await getDocs(query(colRef, where('departmentCode', '==', deptScope)))
      : await getDocs(colRef);
    for (const d of snap.docs) {
      const data = d.data() as ExistingDocMeta;
      map.set(d.id, {
        createdAt: data.createdAt,
        markedAt: data.markedAt,
        ownerUid: data.ownerUid,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
  }
  return map;
}

export const FirebaseSyncService = {
  async verifyFirestoreRead(
    role: 'ADMINISTRATION' | 'HOD',
    department: string | null,
  ): Promise<{ collectionsChecked: number; totalDocumentsRead: number }> {
    if (!auth.currentUser) {
      throw new Error(
        'Connect Google Sign-In in Settings first to read protected Firestore collections.',
      );
    }

    const deptScope = role === 'HOD' && department ? safeDeptCode(department) : null;
    let totalDocumentsRead = 0;
    const collections =
      role === 'ADMINISTRATION'
        ? [
            'departments',
            'students',
            'classrooms',
            'cameras',
            'timetables',
            'classSessions',
            'attendance',
          ]
        : ['departments', 'students', 'classrooms', 'cameras', 'timetables'];

    for (const colName of collections) {
      const colRef = collection(db, colName);
      try {
        const snap =
          deptScope && colName !== 'departments'
            ? await getDocs(query(colRef, where('departmentCode', '==', deptScope)))
            : deptScope && colName === 'departments'
              ? await getDocs(query(colRef, where('code', '==', deptScope)))
              : await getDocs(colRef);
        totalDocumentsRead += snap.size;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, colName);
      }
    }

    return {
      collectionsChecked: collections.length,
      totalDocumentsRead,
    };
  },

  async syncWorkspaceToFirestore(
    data: WorkspaceBootstrapData,
  ): Promise<FirebaseSyncSummary> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error(
        'Connect Google Sign-In first in Settings to authorize Firestore writes.',
      );
    }

    const ownerUid = firebaseUser.uid;
    const isAdmin = data.user.role === 'ADMINISTRATION';
    const deptScope = !isAdmin && data.user.department ? safeDeptCode(data.user.department) : null;
    let documentsWritten = 0;
    let collectionsSynced = 0;

    try {
      // 1. Ensure admin membership & institution doc when in Administration mode
      if (isAdmin) {
        const adminPath = `admins/${ownerUid}`;
        try {
          const adminRef = doc(db, 'admins', ownerUid);
          const existingAdmin = await getDoc(adminRef);
          if (!existingAdmin.exists()) {
            await setDoc(adminRef, {
              email: safeEmail(firebaseUser.email ?? data.user.email, data.user.loginId),
              loginId: safeId(data.user.loginId, 2, 64),
              fullName: data.user.fullName.slice(0, 120) || 'SMARTATTEND Administrator',
              createdAt: serverTimestamp(),
            });
            documentsWritten += 1;
          }
          collectionsSynced += 1;
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, adminPath);
        }

        const instPath = 'institutions/primary';
        try {
          const highConf = Math.min(0.99, Math.max(0.4, data.settings.highConfidenceThreshold));
          const pendingConf = Math.min(
            highConf,
            Math.max(0.2, data.settings.pendingConfidenceThreshold),
          );
          await setDoc(doc(db, 'institutions', 'primary'), {
            name: data.settings.institutionName.slice(0, 140) || 'SMARTATTEND Institution',
            code: safeDeptCode(data.settings.institutionCode),
            lowAttendanceThreshold: Math.min(
              99,
              Math.max(10, Math.round(data.settings.lowAttendanceThreshold)),
            ),
            highConfidenceThreshold: highConf,
            pendingConfidenceThreshold: pendingConf,
            biometricRetentionDays: Math.min(
              3650,
              Math.max(1, Math.round(data.settings.biometricRetentionDays)),
            ),
            biometricPolicyVersion: data.settings.biometricPolicyVersion.slice(0, 24) || 'v2.1',
            allowManualFallback: Boolean(data.settings.allowManualFallback),
            ownerUid,
            updatedAt: serverTimestamp(),
          });
          documentsWritten += 1;
          collectionsSynced += 1;
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, instPath);
        }
      }

      // Helper for batched writes preserving immutable createdAt / ownerUid on updates
      let batch: WriteBatch = writeBatch(db);
      let batchCount = 0;

      const flushBatch = async (force = false) => {
        if ((force && batchCount > 0) || batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      };

      // 2. Base entities (departments, hods, students, classrooms, cameras, subjects, timetables)
      if (isAdmin) {
        const existingDepts = await fetchExistingMetaMap('departments', null);
        for (const dept of data.departments) {
          const docId = safeId(dept.id);
          const prev = existingDepts.get(docId);
          batch.set(doc(db, 'departments', docId), {
            code: safeDeptCode(dept.code),
            name: dept.name.slice(0, 120),
            ...(dept.hodId ? { hodId: safeId(dept.hodId, 1, 64) } : {}),
            ...(dept.hodName ? { hodName: dept.hodName.slice(0, 120) } : {}),
            ...(dept.description ? { description: dept.description.slice(0, 400) } : {}),
            active: Boolean(dept.active),
            ownerUid: prev?.ownerUid ?? ownerUid,
            createdAt: prev?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batchCount += 1;
          documentsWritten += 1;
          await flushBatch(false);
        }
        collectionsSynced += 1;

        const existingHods = await fetchExistingMetaMap('hods', null);
        for (const hod of data.hods) {
          const docId = safeId(hod.id);
          const prev = existingHods.get(docId);
          batch.set(doc(db, 'hods', docId), {
            loginId: safeId(hod.loginId, 3, 64),
            fullName: hod.fullName.slice(0, 120),
            email: safeEmail(hod.email, hod.loginId),
            ...(hod.phone ? { phone: hod.phone.slice(0, 32) } : {}),
            departmentCode: safeDeptCode(hod.department ?? 'CSE'),
            status: hod.active ? 'ACTIVE' : 'INACTIVE',
            ownerUid: prev?.ownerUid ?? ownerUid,
            createdAt: prev?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batchCount += 1;
          documentsWritten += 1;
          await flushBatch(false);
        }
        collectionsSynced += 1;
      }

      const existingStudents = await fetchExistingMetaMap('students', deptScope);
      for (const stu of data.students.slice(0, 150)) {
        const docId = safeId(stu.id);
        const prev = existingStudents.get(docId);
        batch.set(doc(db, 'students', docId), {
          ...(stu.admissionNo ? { admissionNo: safeId(stu.admissionNo, 2, 40) } : {}),
          registerNo: safeId(stu.registerNo, 3, 40),
          rollNo: (stu.rollNo || 'R01').slice(0, 32),
          fullName: stu.fullName.slice(0, 120),
          departmentCode: safeDeptCode(stu.department),
          academicYear: stu.academicYear,
          section: stu.section,
          email: safeEmail(stu.email, stu.registerNo),
          ...(stu.phone ? { phone: stu.phone.slice(0, 32) } : {}),
          enrollmentStatus: stu.enrollmentStatus,
          biometricConsentGranted: Boolean(stu.biometricConsentGranted),
          faceEnrollmentStatus: stu.faceEnrollmentStatus,
          ownerUid: prev?.ownerUid ?? ownerUid,
          createdAt: prev?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batchCount += 1;
        documentsWritten += 1;
        await flushBatch(false);
      }
      collectionsSynced += 1;

      const existingRooms = await fetchExistingMetaMap('classrooms', deptScope);
      if (isAdmin) {
        for (const room of data.classrooms.slice(0, 80)) {
          const docId = safeId(room.id);
          const prev = existingRooms.get(docId);
          batch.set(doc(db, 'classrooms', docId), {
            roomCode: safeId(room.roomCode, 2, 32),
            roomName: room.roomName.slice(0, 120),
            departmentCode: safeDeptCode(room.department),
            academicYear: room.academicYear,
            section: room.section,
            floor: room.floor.slice(0, 32),
            building: room.building.slice(0, 80),
            capacity: Math.min(500, Math.max(1, Math.round(room.capacity))),
            ...(room.assignedCameraId ? { assignedCameraId: safeId(room.assignedCameraId) } : {}),
            status: room.status,
            ownerUid: prev?.ownerUid ?? ownerUid,
            createdAt: prev?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batchCount += 1;
          documentsWritten += 1;
          await flushBatch(false);
        }
        collectionsSynced += 1;
      }

      if (isAdmin) {
        const existingCameras = await fetchExistingMetaMap('cameras', deptScope);
        for (const cam of data.cameras.slice(0, 80)) {
          const docId = safeId(cam.id);
          const prev = existingCameras.get(docId);
          batch.set(doc(db, 'cameras', docId), {
            cameraCode: safeId(cam.cameraCode, 2, 40),
            ...(cam.cameraNumber ? { cameraNumber: cam.cameraNumber.slice(0, 32) } : {}),
            name: cam.name.slice(0, 120),
            ...(cam.classroomId ? { classroomId: safeId(cam.classroomId) } : {}),
            departmentCode: safeDeptCode(cam.department),
            ...(cam.academicYear ? { academicYear: cam.academicYear } : {}),
            ...(cam.section ? { section: cam.section } : {}),
            isSharedLab: Boolean(cam.isSharedLab),
            authorizedDepartments: (cam.authorizedDepartments ?? []).slice(0, 20).map(safeDeptCode),
            sourceType: cam.sourceType,
            connectionLabel: cam.connectionLabel.slice(0, 240),
            online: Boolean(cam.online),
            monitoringActive: Boolean(cam.monitoringActive),
            ...(cam.lastError ? { lastError: cam.lastError.slice(0, 240) } : {}),
            ownerUid: prev?.ownerUid ?? ownerUid,
            createdAt: prev?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batchCount += 1;
          documentsWritten += 1;
          await flushBatch(false);
        }
        collectionsSynced += 1;
      }

      const existingSubjects = await fetchExistingMetaMap('subjects', deptScope);
      for (const sub of data.subjects.slice(0, 80)) {
        const docId = safeId(sub.id);
        const prev = existingSubjects.get(docId);
        batch.set(doc(db, 'subjects', docId), {
          subjectCode: safeId(sub.subjectCode, 2, 24),
          subjectName: sub.subjectName.slice(0, 120),
          departmentCode: safeDeptCode(sub.department),
          academicYear: sub.academicYear,
          facultyName: sub.facultyName.slice(0, 120),
          ownerUid: prev?.ownerUid ?? ownerUid,
          createdAt: prev?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batchCount += 1;
        documentsWritten += 1;
        await flushBatch(false);
      }
      collectionsSynced += 1;

      const existingTimetables = await fetchExistingMetaMap('timetables', deptScope);
      for (const period of data.timetablePeriods.slice(0, 150)) {
        const docId = safeId(period.id);
        const prev = existingTimetables.get(docId);
        batch.set(doc(db, 'timetables', docId), {
          entryKind: 'PERIOD',
          departmentCode: safeDeptCode(period.department),
          academicYear: period.academicYear,
          section: period.section,
          dayOfWeek: period.dayOfWeek,
          periodNumber: period.periodNumber,
          periodLabel: period.periodLabel.slice(0, 48),
          startTime: period.startTime.slice(0, 16),
          endTime: period.endTime.slice(0, 16),
          subjectName: period.subjectName.slice(0, 120),
          facultyName: period.facultyName.slice(0, 120),
          isBreak: Boolean(period.isBreak),
          status: period.status,
          ownerUid: prev?.ownerUid ?? ownerUid,
          createdAt: prev?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batchCount += 1;
        documentsWritten += 1;
        await flushBatch(false);
      }
      collectionsSynced += 1;

      // Commit base entities before dependent classSessions (rules check exists(classrooms/...))
      await flushBatch(true);

      // 3. Class sessions
      const syncedSessionIds = new Set<string>();
      if (isAdmin) {
        const existingSessions = await fetchExistingMetaMap('classSessions', deptScope);
        for (const sess of data.sessions.slice(0, 80)) {
          const classroomDocId = safeId(sess.classroomId);
          // Ensure referenced classroom exists in Firestore
          const hasRoom = data.classrooms.some((r) => safeId(r.id) === classroomDocId);
          if (!hasRoom) continue;

          const docId = safeId(sess.id);
          const prev = existingSessions.get(docId);
          batch.set(doc(db, 'classSessions', docId), {
            departmentCode: safeDeptCode(sess.department),
            academicYear: sess.academicYear,
            section: sess.section,
            classroomId: classroomDocId,
            ...(sess.cameraId ? { cameraId: safeId(sess.cameraId) } : {}),
            subjectId: safeId(sess.subjectId),
            subjectName: sess.subjectName.slice(0, 120),
            sessionDate: sess.sessionDate,
            ...(sess.startTime ? { startTime: sess.startTime.slice(0, 16) } : {}),
            ...(sess.endTime ? { endTime: sess.endTime.slice(0, 16) } : {}),
            status: sess.status,
            ownerUid: prev?.ownerUid ?? ownerUid,
            createdAt: prev?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          syncedSessionIds.add(docId);
          batchCount += 1;
          documentsWritten += 1;
          await flushBatch(false);
        }
        collectionsSynced += 1;
        await flushBatch(true);

        // 4. Attendance records (rules check exists(classSessions/...) && exists(students/...))
        const syncedStudentIds = new Set(data.students.slice(0, 150).map((s) => safeId(s.id)));
        const existingAttendance = await fetchExistingMetaMap('attendance', deptScope);
        for (const att of data.attendance.slice(0, 200)) {
          const sessId = safeId(att.sessionId);
          const stuId = safeId(att.studentId);
          if (!syncedSessionIds.has(sessId) || !syncedStudentIds.has(stuId)) continue;

          const docId = safeId(att.id);
          const prev = existingAttendance.get(docId);
          batch.set(doc(db, 'attendance', docId), {
            sessionId: sessId,
            studentId: stuId,
            departmentCode: safeDeptCode(att.department),
            academicYear: att.academicYear,
            section: att.section,
            sessionDate: att.sessionDate,
            status: att.status,
            verificationSource: att.verificationSource,
            ...(typeof att.confidence === 'number'
              ? { confidence: Math.min(1, Math.max(0, att.confidence)) }
              : {}),
            ...(att.correctionReason
              ? { correctionReason: att.correctionReason.slice(0, 300) }
              : {}),
            ownerUid: prev?.ownerUid ?? ownerUid,
            markedAt: prev?.markedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batchCount += 1;
          documentsWritten += 1;
          await flushBatch(false);
        }
        collectionsSynced += 1;
        await flushBatch(true);
      }

      return {
        syncedAt: new Date().toISOString(),
        collectionsSynced,
        documentsWritten,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('{')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, 'workspace-sync');
    }
  },
};
