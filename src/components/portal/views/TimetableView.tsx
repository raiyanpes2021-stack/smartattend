import { useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, Edit3, Plus, Trash2 } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  DAYS_OF_WEEK,
  SECTIONS,
  type AcademicYear,
  type DayOfWeek,
  type SectionCode,
  type TimetablePeriodRecord,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';

interface TimetableViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
}

export function TimetableView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
}: TimetableViewProps) {
  const [selectedDept, setSelectedDept] = useState<string>(
    lockedDepartment ?? data.departments[0]?.code ?? 'CSE',
  );
  const [selectedYear, setSelectedYear] = useState<AcademicYear>('2nd Year');
  const [selectedSection, setSelectedSection] = useState<SectionCode>('A');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');

  // Period Form
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<TimetablePeriodRecord | null>(null);
  const [periodNumber, setPeriodNumber] = useState(1);
  const [periodLabel, setPeriodLabel] = useState('Period 1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:50');
  const [subjectId, setSubjectId] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [isBreak, setIsBreak] = useState(false);
  const [status, setStatus] = useState<'ACTIVE' | 'CANCELLED'>('ACTIVE');

  // Holiday Form
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [holidayType, setHolidayType] = useState<'HOLIDAY' | 'CANCELLED_DAY' | 'SPECIAL_EVENT'>('HOLIDAY');

  // Date Substitution / Cancel Override Form
  const [ovrDate, setOvrDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ovrPeriodNumber, setOvrPeriodNumber] = useState(1);
  const [ovrType, setOvrType] = useState<'CANCELLED' | 'SUBSTITUTION'>('CANCELLED');
  const [ovrSubjectName, setOvrSubjectName] = useState('');
  const [ovrFacultyName, setOvrFacultyName] = useState('');
  const [ovrReason, setOvrReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deptSubjects = useMemo(
    () => data.subjects.filter((s) => s.department === selectedDept),
    [data.subjects, selectedDept],
  );

  const deptClassrooms = useMemo(
    () => data.classrooms.filter((c) => c.department === selectedDept),
    [data.classrooms, selectedDept],
  );

  const dayPeriods = useMemo(
    () =>
      data.timetablePeriods
        .filter(
          (p) =>
            p.department === selectedDept &&
            p.academicYear === selectedYear &&
            p.section === selectedSection &&
            p.dayOfWeek === selectedDay,
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data.timetablePeriods, selectedDept, selectedYear, selectedSection, selectedDay],
  );

  const openAddPeriod = () => {
    setEditingPeriod(null);
    const defaultSub = deptSubjects.find((s) => s.academicYear === selectedYear) ?? deptSubjects[0];
    setPeriodNumber(Math.min(7, dayPeriods.filter((p) => !p.isBreak).length + 1));
    setPeriodLabel(`Period ${Math.min(7, dayPeriods.filter((p) => !p.isBreak).length + 1)}`);
    setStartTime('09:00');
    setEndTime('09:50');
    setSubjectId(defaultSub?.id ?? '');
    setSubjectCode(defaultSub?.subjectCode ?? '');
    setSubjectName(defaultSub?.subjectName ?? '');
    setFacultyName(defaultSub?.facultyName ?? '');
    setClassroomId(deptClassrooms[0]?.id ?? '');
    setIsBreak(false);
    setStatus('ACTIVE');
    setError(null);
    setShowPeriodForm(true);
  };

  const openEditPeriod = (p: TimetablePeriodRecord) => {
    setEditingPeriod(p);
    setPeriodNumber(p.periodNumber || 1);
    setPeriodLabel(p.periodLabel);
    setStartTime(p.startTime);
    setEndTime(p.endTime);
    setSubjectId(p.subjectId ?? '');
    setSubjectCode(p.subjectCode);
    setSubjectName(p.subjectName);
    setFacultyName(p.facultyName);
    setClassroomId(p.classroomId ?? '');
    setIsBreak(p.isBreak);
    setStatus(p.status);
    setError(null);
    setShowPeriodForm(true);
  };

  const handleSavePeriod = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await SmartAttendService.upsertTimetablePeriod({
        id: editingPeriod?.id,
        department: selectedDept,
        academicYear: selectedYear,
        section: selectedSection,
        dayOfWeek: selectedDay,
        periodNumber: isBreak ? 0 : periodNumber,
        periodLabel: isBreak ? periodLabel || 'Break' : periodLabel || `Period ${periodNumber}`,
        startTime,
        endTime,
        subjectId: isBreak ? null : subjectId || null,
        subjectCode: isBreak ? 'BREAK' : subjectCode,
        subjectName: isBreak ? periodLabel || 'Break' : subjectName,
        facultyName: isBreak ? '—' : facultyName,
        classroomId: classroomId || null,
        isBreak,
        status,
      });
      setShowPeriodForm(false);
      setFeedback(`Saved ${selectedDay} timetable slot (${startTime}–${endTime}).`);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save timetable period.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await SmartAttendService.deleteTimetablePeriod(id);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete period.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await SmartAttendService.createHoliday({
        date: holidayDate,
        title: holidayTitle,
        department: isAdmin ? 'ALL' : selectedDept,
        type: holidayType,
      });
      setHolidayDate('');
      setHolidayTitle('');
      setFeedback('Holiday / non-instructional day recorded.');
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await SmartAttendService.upsertTimetableOverride({
        date: ovrDate,
        department: selectedDept,
        academicYear: selectedYear,
        section: selectedSection,
        periodNumber: ovrPeriodNumber,
        overrideType: ovrType,
        subjectName: ovrType === 'SUBSTITUTION' ? ovrSubjectName : undefined,
        facultyName: ovrType === 'SUBSTITUTION' ? ovrFacultyName : undefined,
        reason: ovrReason,
      });
      setOvrReason('');
      setFeedback(`Saved ${ovrType.toLowerCase()} override for ${ovrDate} Period ${ovrPeriodNumber}.`);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save date override.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
            Timetable Management &amp; Dynamic Class Schedule
          </h2>
          <p className="text-xs text-slate-600">
            Configure weekly periods, breaks, holidays, cancellations, and faculty substitutions.
            Camera cards dynamically reflect the live timetable in real time.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddPeriod}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Add Period / Break</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Cohort & Day Filters */}
      <div className="grid gap-3 rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs sm:grid-cols-4">
        {isAdmin ? (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
            >
              {data.departments.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Department</label>
            <div className="rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] px-3 py-2 font-mono text-xs font-semibold text-[#172B2A]">
              {selectedDept}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Academic Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value as AcademicYear)}
            className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value as SectionCode)}
            className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Day of Week</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
            className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Period Add/Edit Modal Drawer */}
      {showPeriodForm && (
        <form
          onSubmit={handleSavePeriod}
          className="rounded-xl border border-[#10B981]/50 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-[#D1E7DC] pb-3">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              {editingPeriod ? 'Edit Timetable Slot' : 'Add Timetable Slot'} · {selectedDept}{' '}
              {selectedYear} Sec {selectedSection} ({selectedDay})
            </h3>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#172B2A]">
              <input
                type="checkbox"
                checked={isBreak}
                onChange={(e) => setIsBreak(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#10B981]"
              />
              <span>Mark as Break / Lunch Slot</span>
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!isBreak && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Period Number
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={periodNumber}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    setPeriodNumber(num);
                    setPeriodLabel(`Period ${num}`);
                  }}
                  className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Slot Label</label>
              <input
                type="text"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder={isBreak ? 'Lunch Break' : 'Period 1'}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Start Time (24h HH:MM)
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                End Time (24h HH:MM)
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
              />
            </div>

            {!isBreak && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Link Saved Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      const sub = deptSubjects.find((s) => s.id === e.target.value);
                      setSubjectId(e.target.value);
                      if (sub) {
                        setSubjectCode(sub.subjectCode);
                        setSubjectName(sub.subjectName);
                        setFacultyName(sub.facultyName);
                      }
                    }}
                    className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
                  >
                    <option value="">Custom Subject Title</option>
                    {deptSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subjectCode} · {s.subjectName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Subject Code &amp; Name
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={subjectCode}
                      onChange={(e) => setSubjectCode(e.target.value)}
                      placeholder="CS201"
                      className="rounded-lg border border-[#CBDCD4] bg-white px-2 py-2 font-mono text-xs text-[#0F1F1E]"
                    />
                    <input
                      type="text"
                      required
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      placeholder="Data Structures"
                      className="col-span-2 rounded-lg border border-[#CBDCD4] bg-white px-2.5 py-2 text-xs text-[#0F1F1E]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Faculty Name
                  </label>
                  <input
                    type="text"
                    required
                    value={facultyName}
                    onChange={(e) => setFacultyName(e.target.value)}
                    placeholder="Prof. Meenakshi"
                    className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Classroom</label>
                  <select
                    value={classroomId}
                    onChange={(e) => setClassroomId(e.target.value)}
                    className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
                  >
                    <option value="">Cohort Room Default</option>
                    {deptClassrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.roomCode} · {c.roomName}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'CANCELLED')}
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-1.5 text-xs text-[#0F1F1E]"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPeriodForm(false)}
                className="rounded-lg border border-[#CBDCD4] px-3.5 py-1.5 text-xs text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-[#06281E]"
              >
                {saving ? 'Saving...' : 'Save Period'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Weekly Day Schedule Table */}
      <section className="overflow-x-auto rounded-xl border border-[#D1E7DC] bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D1E7DC] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#059669]" aria-hidden="true" />
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              {selectedDay} Schedule · {selectedDept} {selectedYear} Sec {selectedSection}
            </h3>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            {dayPeriods.length} slot(s) configured
          </span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D1E7DC] bg-[#F8FCF9] text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Slot / Period</th>
              <th className="px-4 py-3 font-medium">Timing</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Faculty</th>
              <th className="px-4 py-3 font-medium">Classroom</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6F2EC]">
            {dayPeriods.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No periods scheduled for {selectedDay}. Click &ldquo;Add Period / Break&rdquo; to
                  configure this day.
                </td>
              </tr>
            ) : (
              dayPeriods.map((p) => {
                const room = data.classrooms.find((c) => c.id === p.classroomId);
                return (
                  <tr key={p.id} className={p.isBreak ? 'bg-[#F8FCF9]/80' : 'hover:bg-[#F8FCF9]'}>
                    <td className="px-4 py-3 font-mono font-semibold text-[#172B2A]">
                      {p.isBreak ? 'BREAK' : `P${p.periodNumber} · ${p.periodLabel}`}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                      {p.startTime} – {p.endTime}
                    </td>
                    <td className="px-4 py-3">
                      {p.isBreak ? (
                        <span className="italic text-slate-500">{p.periodLabel}</span>
                      ) : (
                        <div>
                          <span className="font-mono text-[#059669]">{p.subjectCode}</span> ·{' '}
                          <span className="font-medium text-[#172B2A]">{p.subjectName}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.facultyName}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {room ? room.roomCode : 'Default'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          p.status === 'ACTIVE'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditPeriod(p)}
                          className="inline-flex items-center gap-1 rounded border border-[#CBDCD4] px-2 py-1 text-[11px] text-[#172B2A] hover:border-[#10B981]"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeletePeriod(p.id)}
                          className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Date-Specific Overrides (Cancellations / Substitutions) & Holidays */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              Period Cancellation / Faculty Substitution
            </h3>
            <p className="text-[11px] text-slate-600">
              Cancelled classes are automatically excluded from Full-Day Attendance penalties.
            </p>
          </div>

          <form onSubmit={handleAddOverride} className="grid gap-2.5 sm:grid-cols-2">
            <input
              type="date"
              required
              value={ovrDate}
              onChange={(e) => setOvrDate(e.target.value)}
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={ovrPeriodNumber}
                onChange={(e) => setOvrPeriodNumber(Number(e.target.value))}
                placeholder="Period #"
                className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs"
              />
              <select
                value={ovrType}
                onChange={(e) => setOvrType(e.target.value as 'CANCELLED' | 'SUBSTITUTION')}
                className="rounded-lg border border-[#CBDCD4] bg-white px-2 py-2 text-xs"
              >
                <option value="CANCELLED">CANCELLED</option>
                <option value="SUBSTITUTION">SUBSTITUTION</option>
              </select>
            </div>
            {ovrType === 'SUBSTITUTION' && (
              <>
                <input
                  type="text"
                  required
                  value={ovrSubjectName}
                  onChange={(e) => setOvrSubjectName(e.target.value)}
                  placeholder="Substitute Subject Name"
                  className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  required
                  value={ovrFacultyName}
                  onChange={(e) => setOvrFacultyName(e.target.value)}
                  placeholder="Substitute Faculty"
                  className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs"
                />
              </>
            )}
            <input
              type="text"
              value={ovrReason}
              onChange={(e) => setOvrReason(e.target.value)}
              placeholder="Reason (e.g., Guest Seminar / Faculty Leave)"
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs sm:col-span-2"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#172B2A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10201F] sm:col-span-2"
            >
              Apply Date Override
            </button>
          </form>

          <div className="max-h-40 space-y-2 overflow-y-auto">
            {data.timetableOverrides.map((ovr) => (
              <div
                key={ovr.id}
                className="flex items-center justify-between rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[#172B2A]">
                    {ovr.date} · P{ovr.periodNumber} ({ovr.department} {ovr.academicYear} Sec {ovr.section})
                  </span>
                  <div className="text-[11px] text-slate-600">
                    {ovr.overrideType}
                    {ovr.subjectName ? ` → ${ovr.subjectName} (${ovr.facultyName})` : ''}
                    {ovr.reason ? ` · ${ovr.reason}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void SmartAttendService.deleteTimetableOverride(ovr.id).then(onDataChanged)}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
              Holidays &amp; Non-Working Days
            </h3>
            <p className="text-[11px] text-slate-600">
              Holidays are skipped by live timetable alerts and Full-Day Attendance calculations.
            </p>
          </div>

          <form onSubmit={handleAddHoliday} className="grid gap-2.5 sm:grid-cols-3">
            <input
              type="date"
              required
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs"
            />
            <input
              type="text"
              required
              value={holidayTitle}
              onChange={(e) => setHolidayTitle(e.target.value)}
              placeholder="Holiday / Event Name"
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs"
            />
            <select
              value={holidayType}
              onChange={(e) =>
                setHolidayType(e.target.value as 'HOLIDAY' | 'CANCELLED_DAY' | 'SPECIAL_EVENT')
              }
              className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs"
            >
              <option value="HOLIDAY">HOLIDAY</option>
              <option value="CANCELLED_DAY">CANCELLED DAY</option>
              <option value="SPECIAL_EVENT">SPECIAL EVENT</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#172B2A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10201F] sm:col-span-3"
            >
              Add Holiday / Event Day
            </button>
          </form>

          <div className="max-h-40 space-y-2 overflow-y-auto">
            {data.holidays.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
                No holidays or cancelled days marked yet.
              </p>
            ) : (
              data.holidays.map((hol) => (
                <div
                  key={hol.id}
                  className="flex items-center justify-between rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-[#172B2A]">{hol.date}</span> ·{' '}
                    <span className="font-medium text-[#059669]">{hol.title}</span>
                    <span className="ml-2 text-[10px] text-slate-500">
                      ({hol.type} · {hol.department})
                    </span>
                  </div>
                  {(isAdmin || hol.department === selectedDept) && (
                    <button
                      type="button"
                      onClick={() => void SmartAttendService.deleteHoliday(hol.id).then(onDataChanged)}
                      className="rounded p-1 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
