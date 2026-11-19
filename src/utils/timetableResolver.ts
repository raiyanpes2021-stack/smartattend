import type { DepartmentCode } from '../types/auth';
import type {
  AcademicYear,
  DayOfWeek,
  SectionCode,
  TimetableHolidayRecord,
  TimetableOverrideRecord,
  TimetablePeriodRecord,
} from '../types/smartattend';

export type TimetableResolutionState =
  | 'ACTIVE_CLASS'
  | 'BREAK'
  | 'HOLIDAY'
  | 'CANCELLED'
  | 'NO_SCHEDULED_CLASS';

export interface ResolvedTimetableContext {
  state: TimetableResolutionState;
  dateStr: string;
  timeStr: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number | null;
  periodLabel: string;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string;
  facultyName: string;
  classroomId: string | null;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

const JS_DAY_MAP: readonly DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function getInstitutionNowParts(
  timezone = 'Asia/Kolkata',
  now: Date = new Date(),
): { dateStr: string; timeStr: string; dayOfWeek: DayOfWeek } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let hour = get('hour');
    if (hour === '24') hour = '00';
    const minute = get('minute');
    const weekday = get('weekday');
    const matchedDay =
      JS_DAY_MAP.find((d) => d.toLowerCase() === weekday.toLowerCase()) ??
      JS_DAY_MAP[now.getDay()];

    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hour}:${minute}`,
      dayOfWeek: matchedDay,
    };
  } catch {
    const iso = now.toISOString();
    return {
      dateStr: iso.slice(0, 10),
      timeStr: iso.slice(11, 16),
      dayOfWeek: JS_DAY_MAP[now.getUTCDay()],
    };
  }
}

export function getDayOfWeekForDate(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 'Monday';
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return JS_DAY_MAP[dt.getUTCDay()];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export function resolveCurrentTimetableContext(params: {
  department: DepartmentCode;
  academicYear: AcademicYear;
  section: SectionCode;
  classroomId?: string | null;
  timezone?: string;
  overrideDateStr?: string;
  overrideTimeStr?: string;
  periods: TimetablePeriodRecord[];
  holidays: TimetableHolidayRecord[];
  overrides: TimetableOverrideRecord[];
}): ResolvedTimetableContext {
  const instNow = getInstitutionNowParts(params.timezone || 'Asia/Kolkata');
  const dateStr = params.overrideDateStr || instNow.dateStr;
  const timeStr = params.overrideTimeStr || instNow.timeStr;
  const dayOfWeek = params.overrideDateStr
    ? getDayOfWeekForDate(params.overrideDateStr)
    : instNow.dayOfWeek;

  // 1. Holiday / Cancelled Day check
  const holiday = params.holidays.find(
    (h) =>
      h.date === dateStr &&
      (h.department === 'ALL' || h.department === params.department),
  );
  if (holiday) {
    return {
      state: 'HOLIDAY',
      dateStr,
      timeStr,
      dayOfWeek,
      periodNumber: null,
      periodLabel: 'Holiday',
      subjectId: null,
      subjectCode: null,
      subjectName: holiday.title,
      facultyName: '—',
      classroomId: params.classroomId ?? null,
      startTime: null,
      endTime: null,
      reason: `${holiday.type}: ${holiday.title}`,
    };
  }

  // 2. Filter matching periods for department + cohort + dayOfWeek
  const cohortPeriods = params.periods.filter(
    (p) =>
      p.department === params.department &&
      p.academicYear === params.academicYear &&
      p.section === params.section &&
      p.dayOfWeek === dayOfWeek,
  );

  const nowMins = toMinutes(timeStr);
  let matched = cohortPeriods.find((p) => {
    const startM = toMinutes(p.startTime);
    const endM = toMinutes(p.endTime);
    return startM >= 0 && endM > startM && nowMins >= startM && nowMins < endM;
  });

  if (!matched && params.classroomId) {
    matched = params.periods.find((p) => {
      if (p.classroomId !== params.classroomId || p.dayOfWeek !== dayOfWeek) return false;
      const startM = toMinutes(p.startTime);
      const endM = toMinutes(p.endTime);
      return startM >= 0 && endM > startM && nowMins >= startM && nowMins < endM;
    });
  }

  if (!matched) {
    return {
      state: 'NO_SCHEDULED_CLASS',
      dateStr,
      timeStr,
      dayOfWeek,
      periodNumber: null,
      periodLabel: 'No Active Period',
      subjectId: null,
      subjectCode: null,
      subjectName: 'No Scheduled Class',
      facultyName: '—',
      classroomId: params.classroomId ?? null,
      startTime: null,
      endTime: null,
      reason: `No timetable entry active at ${timeStr} (${dayOfWeek}).`,
    };
  }

  // 3. Check Date Override for matched period
  const override = params.overrides.find(
    (o) =>
      o.date === dateStr &&
      o.department === matched.department &&
      o.academicYear === matched.academicYear &&
      o.section === matched.section &&
      o.periodNumber === matched.periodNumber,
  );

  if (override?.overrideType === 'CANCELLED' || matched.status === 'CANCELLED') {
    return {
      state: 'CANCELLED',
      dateStr,
      timeStr,
      dayOfWeek,
      periodNumber: matched.periodNumber,
      periodLabel: matched.periodLabel,
      subjectId: matched.subjectId,
      subjectCode: matched.subjectCode,
      subjectName: `${matched.subjectName} (Cancelled)`,
      facultyName: matched.facultyName,
      classroomId: matched.classroomId ?? params.classroomId ?? null,
      startTime: matched.startTime,
      endTime: matched.endTime,
      reason: override?.reason || 'Period cancelled in timetable.',
    };
  }

  if (matched.isBreak) {
    return {
      state: 'BREAK',
      dateStr,
      timeStr,
      dayOfWeek,
      periodNumber: matched.periodNumber,
      periodLabel: matched.periodLabel,
      subjectId: null,
      subjectCode: null,
      subjectName: matched.periodLabel || 'Scheduled Break',
      facultyName: '—',
      classroomId: matched.classroomId ?? params.classroomId ?? null,
      startTime: matched.startTime,
      endTime: matched.endTime,
      reason: 'Scheduled institutional break window.',
    };
  }

  if (override?.overrideType === 'SUBSTITUTION') {
    return {
      state: 'ACTIVE_CLASS',
      dateStr,
      timeStr,
      dayOfWeek,
      periodNumber: matched.periodNumber,
      periodLabel: matched.periodLabel,
      subjectId: override.subjectId ?? matched.subjectId,
      subjectCode: override.subjectCode || matched.subjectCode,
      subjectName: override.subjectName || matched.subjectName,
      facultyName: override.facultyName || matched.facultyName,
      classroomId: override.classroomId ?? matched.classroomId ?? params.classroomId ?? null,
      startTime: matched.startTime,
      endTime: matched.endTime,
      reason: override.reason ? `Substitution: ${override.reason}` : 'Timetable substitution active.',
    };
  }

  return {
    state: 'ACTIVE_CLASS',
    dateStr,
    timeStr,
    dayOfWeek,
    periodNumber: matched.periodNumber,
    periodLabel: matched.periodLabel,
    subjectId: matched.subjectId,
    subjectCode: matched.subjectCode,
    subjectName: matched.subjectName,
    facultyName: matched.facultyName,
    classroomId: matched.classroomId ?? params.classroomId ?? null,
    startTime: matched.startTime,
    endTime: matched.endTime,
    reason: null,
  };
}
