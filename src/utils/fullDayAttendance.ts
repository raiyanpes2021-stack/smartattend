import type {
  AttendanceRecord,
  ClassSessionRecord,
  StudentRecord,
  TimetableHolidayRecord,
  TimetableOverrideRecord,
  TimetablePeriodRecord,
} from '../types/smartattend';
import { getDayOfWeekForDate } from './timetableResolver';

export type FullDayStatus =
  | 'FULL_DAY_PRESENT'
  | 'FULL_DAY_ABSENT'
  | 'HOLIDAY'
  | 'NO_ACTIVE_CHECKPOINTS'
  | 'PENDING_RECORDS';

export interface CheckpointDetail {
  periodNumber: number;
  status: 'PRESENT' | 'ABSENT' | 'PENDING' | 'CANCELLED' | 'MISSING';
}

export interface StudentFullDayResult {
  student: StudentRecord;
  date: string;
  fullDayStatus: FullDayStatus;
  shortCode: 'P' | 'A' | 'H' | '—';
  checkpoints: CheckpointDetail[];
  activeCheckpointsCount: number;
  presentCheckpointsCount: number;
  absentCheckpointsCount: number;
  missingCheckpointsCount: number;
}

export function isAttendanceConsideredPresent(status: AttendanceRecord['status']): boolean {
  return (
    status === 'PRESENT' ||
    status === 'LATE' ||
    status === 'EXCUSED' ||
    status === 'MANUALLY_CORRECTED'
  );
}

export function evaluateFullDayAttendanceForDate(params: {
  students: StudentRecord[];
  date: string;
  checkpointPeriods: number[];
  attendance: AttendanceRecord[];
  sessions: ClassSessionRecord[];
  periods: TimetablePeriodRecord[];
  holidays: TimetableHolidayRecord[];
  overrides: TimetableOverrideRecord[];
}): StudentFullDayResult[] {
  const checkpointsSorted = [...new Set(params.checkpointPeriods)]
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);

  const dayOfWeek = getDayOfWeekForDate(params.date);
  const results: StudentFullDayResult[] = [];

  for (const stu of params.students) {
    const holiday = params.holidays.find(
      (h) =>
        h.date === params.date &&
        (h.department === 'ALL' || h.department === stu.department),
    );
    if (holiday) {
      results.push({
        student: stu,
        date: params.date,
        fullDayStatus: 'HOLIDAY',
        shortCode: 'H',
        checkpoints: checkpointsSorted.map((p) => ({ periodNumber: p, status: 'CANCELLED' })),
        activeCheckpointsCount: 0,
        presentCheckpointsCount: 0,
        absentCheckpointsCount: 0,
        missingCheckpointsCount: 0,
      });
      continue;
    }

    const stuAttendanceOnDate = params.attendance.filter(
      (a) => a.studentId === stu.id && a.sessionDate === params.date,
    );
    const sessionsById = new Map(params.sessions.map((s) => [s.id, s]));

    const details: CheckpointDetail[] = [];
    let activeCount = 0;
    let presentCount = 0;
    let absentCount = 0;
    let missingCount = 0;

    for (const cp of checkpointsSorted) {
      // Check if timetable marks this period cancelled on this date
      const ttPeriod = params.periods.find(
        (p) =>
          p.department === stu.department &&
          p.academicYear === stu.academicYear &&
          p.section === stu.section &&
          p.dayOfWeek === dayOfWeek &&
          p.periodNumber === cp,
      );
      const override = params.overrides.find(
        (o) =>
          o.date === params.date &&
          o.department === stu.department &&
          o.academicYear === stu.academicYear &&
          o.section === stu.section &&
          o.periodNumber === cp,
      );

      if (ttPeriod?.status === 'CANCELLED' || override?.overrideType === 'CANCELLED') {
        details.push({ periodNumber: cp, status: 'CANCELLED' });
        continue;
      }

      activeCount += 1;

      const matchedRec = stuAttendanceOnDate.find((rec) => {
        const periodNum =
          typeof rec.periodNumber === 'number' && rec.periodNumber > 0
            ? rec.periodNumber
            : sessionsById.get(rec.sessionId)?.periodNumber ?? 1;
        return periodNum === cp;
      });

      if (!matchedRec) {
        // Missing records MUST NEVER be silently classified as ABSENT
        missingCount += 1;
        details.push({ periodNumber: cp, status: 'MISSING' });
      } else if (
        matchedRec.status === 'PENDING_VERIFICATION' ||
        matchedRec.status === 'UNKNOWN'
      ) {
        missingCount += 1;
        details.push({ periodNumber: cp, status: 'PENDING' });
      } else if (isAttendanceConsideredPresent(matchedRec.status)) {
        presentCount += 1;
        details.push({ periodNumber: cp, status: 'PRESENT' });
      } else {
        absentCount += 1;
        details.push({ periodNumber: cp, status: 'ABSENT' });
      }
    }

    let fullDayStatus: FullDayStatus;
    let shortCode: 'P' | 'A' | 'H' | '—';

    if (activeCount === 0) {
      fullDayStatus = 'NO_ACTIVE_CHECKPOINTS';
      shortCode = '—';
    } else if (absentCount > 0) {
      // At least one explicitly recorded ABSENT in a required checkpoint period
      fullDayStatus = 'FULL_DAY_ABSENT';
      shortCode = 'A';
    } else if (missingCount > 0) {
      // Do NOT mark missing records silently as ABSENT
      fullDayStatus = 'PENDING_RECORDS';
      shortCode = '—';
    } else {
      fullDayStatus = 'FULL_DAY_PRESENT';
      shortCode = 'P';
    }

    results.push({
      student: stu,
      date: params.date,
      fullDayStatus,
      shortCode,
      checkpoints: details,
      activeCheckpointsCount: activeCount,
      presentCheckpointsCount: presentCount,
      absentCheckpointsCount: absentCount,
      missingCheckpointsCount: missingCount,
    });
  }

  return results;
}
