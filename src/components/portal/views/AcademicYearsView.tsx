import { useState, type FormEvent } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type AcademicYear,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';

interface AcademicYearsViewProps {
  data: WorkspaceBootstrapData;
  department: DepartmentCode;
  onDataChanged: () => Promise<void>;
}

export function AcademicYearsView({
  data,
  department,
  onDataChanged,
}: AcademicYearsViewProps) {
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [academicYear, setAcademicYear] = useState<AcademicYear>('2nd Year');
  const [facultyName, setFacultyName] = useState('');
  const [credits, setCredits] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSubject = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.createSubject({
        subjectCode,
        subjectName,
        department,
        academicYear,
        facultyName,
        credits,
      });
      setShowAddSubject(false);
      setSubjectCode('');
      setSubjectName('');
      setFacultyName('');
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add subject.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#172B2A]">
            {department} Academic Years, Sections &amp; Subjects
          </h2>
          <p className="text-xs text-[#475569]">
            Track 1st–4th Year cohorts (Sections A–C) and curriculum subjects in {department}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddSubject((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Add Subject</span>
        </button>
      </div>

      {showAddSubject && (
        <form
          onSubmit={handleAddSubject}
          className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            Add Curriculum Subject · {department}
          </h3>
          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Subject Code</label>
              <input
                type="text"
                required
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="CS2204"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Subject Title</label>
              <input
                type="text"
                required
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Operating Systems"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Academic Year</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value as AcademicYear)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Faculty</label>
              <input
                type="text"
                required
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                placeholder="Dr. S. Krishnan"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <span>Credits:</span>
              <input
                type="number"
                min={1}
                max={6}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-16 rounded border border-[#D1E7DC] bg-white px-2 py-1 font-mono text-xs text-[#172B2A]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddSubject(false)}
                className="rounded-lg border border-[#D1E7DC] bg-white px-3 py-1.5 text-xs font-medium text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                {saving ? 'Saving...' : 'Save Subject'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ACADEMIC_YEARS.map((year) => {
          const yearStudents = data.students.filter((s) => s.academicYear === year);
          const yearBiometric = yearStudents.filter(
            (s) => s.faceEnrollmentStatus === 'ENROLLED',
          ).length;
          const yearAtt = data.attendance.filter(
            (a) =>
              a.academicYear === year &&
              a.status !== 'PENDING_VERIFICATION' &&
              a.status !== 'UNKNOWN',
          );
          const yearPresent = yearAtt.filter(
            (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
          ).length;
          const yearRate = yearAtt.length > 0 ? (yearPresent / yearAtt.length) * 100 : 0;

          return (
            <div
              key={year}
              className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E2EFE8] pb-3">
                <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                  {year}
                </h3>
                <span className="font-mono text-xs font-semibold tabular-nums text-[#059669]">
                  {yearRate.toFixed(1)}% Attendance
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {SECTIONS.map((sec) => {
                  const count = yearStudents.filter((s) => s.section === sec).length;
                  return (
                    <div
                      key={sec}
                      className="rounded-lg border border-[#E2EFE8] bg-[#F8FCF9] px-3 py-2"
                    >
                      <span className="block text-[10px] text-[#64748B]">Section {sec}</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-[#172B2A]">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-[#475569]">
                <span>Total Enrolled: {yearStudents.length}</span>
                <span>Face Biometrics: {yearBiometric}</span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-[#E2EFE8] pb-3">
          <BookOpen className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            Department Curriculum Subjects
          </h3>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E2EFE8] bg-[#F8FCF9] text-[#475569]">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Year</th>
                <th className="px-3 py-2 font-semibold">Faculty</th>
                <th className="px-3 py-2 font-semibold">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2EFE8]">
              {data.subjects.map((sub) => (
                <tr key={sub.id} className="hover:bg-[#F0FDF4]/60">
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#059669]">
                    {sub.subjectCode}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-[#172B2A]">{sub.subjectName}</td>
                  <td className="px-3 py-2.5 text-[#475569]">{sub.academicYear}</td>
                  <td className="px-3 py-2.5 text-[#475569]">{sub.facultyName}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-[#172B2A]">{sub.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
