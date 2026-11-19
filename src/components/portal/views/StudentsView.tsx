import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Camera,
  FileSpreadsheet,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { extractSingleFaceDescriptor } from '../../../services/FaceVisionEngine';
import { parseStudentSpreadsheetFile } from '../../../services/ReportExporter';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type AcademicYear,
  type SectionCode,
  type StudentEnrollmentStatus,
  type StudentRecord,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';

interface StudentsViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
}

export function StudentsView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
}: StudentsViewProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>(lockedDepartment ?? 'ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [bioFilter, setBioFilter] = useState<string>('ALL');

  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [profileStudent, setProfileStudent] = useState<StudentRecord | null>(null);

  // Add/Edit Student Form State
  const [admissionNo, setAdmissionNo] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState<string>(
    lockedDepartment ?? data.departments[0]?.code ?? 'CSE',
  );
  const [academicYear, setAcademicYear] = useState<AcademicYear>('2nd Year');
  const [section, setSection] = useState<SectionCode>('A');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<StudentEnrollmentStatus>('ACTIVE');

  // Excel / CSV Import State
  const [csvText, setCsvText] = useState(
    'registerNo,rollNo,fullName,department,academicYear,section,email,phone\n23CSE099,CS99,Kiran Raj,CSE,2nd Year,A,kiran.r@smartattend.edu,+91 98401 99099',
  );
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Biometric Enrollment State inside Profile Drawer
  const [consentChecked, setConsentChecked] = useState(false);
  const [enrollingBio, setEnrollingBio] = useState(false);
  const [bioMessage, setBioMessage] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopEnrollmentWebcam = () => {
    if (webcamStreamRef.current) {
      for (const track of webcamStreamRef.current.getTracks()) {
        track.stop();
      }
      webcamStreamRef.current = null;
    }
    setWebcamOpen(false);
  };

  useEffect(() => {
    return () => {
      stopEnrollmentWebcam();
    };
  }, []);

  const openAdd = () => {
    setEditingStudent(null);
    setAdmissionNo('');
    setRegisterNo('');
    setRollNo('');
    setFullName('');
    setDepartment(lockedDepartment ?? data.departments[0]?.code ?? 'CSE');
    setAcademicYear('2nd Year');
    setSection('A');
    setEmail('');
    setPhone('');
    setEnrollmentStatus('ACTIVE');
    setError(null);
    setShowAddEdit(true);
  };

  const openEdit = (stu: StudentRecord) => {
    setEditingStudent(stu);
    setAdmissionNo(stu.admissionNo ?? stu.registerNo);
    setRegisterNo(stu.registerNo);
    setRollNo(stu.rollNo);
    setFullName(stu.fullName);
    setDepartment(stu.department);
    setAcademicYear(stu.academicYear);
    setSection(stu.section);
    setEmail(stu.email);
    setPhone(stu.phone);
    setEnrollmentStatus(stu.enrollmentStatus);
    setError(null);
    setShowAddEdit(true);
  };

  const openProfile = (stu: StudentRecord) => {
    stopEnrollmentWebcam();
    setProfileStudent(stu);
    setConsentChecked(stu.biometricConsentGranted);
    setBioMessage(null);
    setBioError(null);
  };

  const handleSaveStudent = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingStudent) {
        await SmartAttendService.updateStudent(editingStudent.id, {
          admissionNo: admissionNo || editingStudent.registerNo,
          rollNo,
          fullName,
          department: isAdmin ? department : editingStudent.department,
          academicYear,
          section,
          email,
          phone,
          enrollmentStatus,
        });
      } else {
        await SmartAttendService.createStudent({
          admissionNo: admissionNo || registerNo,
          registerNo,
          rollNo,
          fullName,
          department: lockedDepartment ?? department,
          academicYear,
          section,
          email,
          phone,
          enrollmentStatus,
        });
      }
      setShowAddEdit(false);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save student record.');
    } finally {
      setSaving(false);
    }
  };

  const handleCsvSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setImportSummary(null);
    try {
      const res = await SmartAttendService.importStudentsCsv(csvText);
      const errPreview = res.errors.slice(0, 3).join(' | ');
      setImportSummary(
        `Imported ${res.imported} student(s), skipped ${res.skipped}.${errPreview ? ` Notes: ${errPreview}` : ''}`,
      );
      await onDataChanged();
    } catch (err) {
      setImportSummary(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSpreadsheetUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setImportSummary(null);
    try {
      const rows = await parseStudentSpreadsheetFile(file);
      if (rows.length === 0) {
        setImportSummary(
          'No valid rows detected. Include columns: Register No, Roll No, Student Name, Department, Year, Section, Email.',
        );
        return;
      }
      const res = await SmartAttendService.importStudentsBatch(rows);
      const errPreview = res.errors.slice(0, 3).join(' | ');
      setImportSummary(
        `Spreadsheet "${file.name}": Imported ${res.imported} student(s), skipped ${res.skipped}.${errPreview ? ` Notes: ${errPreview}` : ''}`,
      );
      await onDataChanged();
    } catch (err) {
      setImportSummary(err instanceof Error ? err.message : 'Spreadsheet import failed.');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handlePhotoEnrollment = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!profileStudent) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!consentChecked) {
      setBioError('Check the explicit student biometric consent box before capturing a template.');
      return;
    }

    setBioError(null);
    setBioMessage('Loading neural face models & extracting 128-d descriptor...');
    setEnrollingBio(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Invalid image format.'));
        image.src = dataUrl;
      });

      const { descriptor, portraitDataUrl, detectionScore } =
        await extractSingleFaceDescriptor(img);

      const saved = await SmartAttendService.saveFaceEnrollment({
        studentId: profileStudent.id,
        consentGranted: true,
        descriptor,
        photoDataUrl: portraitDataUrl || dataUrl,
      });

      setProfileStudent(saved.student);
      setBioMessage(
        `Face template enrolled (detection score ${(detectionScore * 100).toFixed(1)}%, 128-d vector stored).`,
      );
      await onDataChanged();
    } catch (err) {
      setBioError(err instanceof Error ? err.message : 'Face enrollment failed.');
      setBioMessage(null);
    } finally {
      setEnrollingBio(false);
      e.target.value = '';
    }
  };

  const startEnrollmentWebcam = async () => {
    setBioError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setBioError('Browser camera access (getUserMedia) is unavailable in this environment.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      webcamStreamRef.current = stream;
      setWebcamOpen(true);
      requestAnimationFrame(() => {
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          void webcamVideoRef.current.play();
        }
      });
    } catch (err) {
      setBioError(
        err instanceof Error ? err.message : 'Camera permission was denied or no camera found.',
      );
    }
  };

  const captureWebcamEnrollment = async () => {
    if (!profileStudent || !webcamVideoRef.current) return;
    if (!consentChecked) {
      setBioError('Confirm explicit student biometric consent before capturing.');
      return;
    }

    setBioError(null);
    setBioMessage('Analyzing webcam frame & extracting 128-d face descriptor...');
    setEnrollingBio(true);

    try {
      const { descriptor, portraitDataUrl, detectionScore } =
        await extractSingleFaceDescriptor(webcamVideoRef.current);

      const saved = await SmartAttendService.saveFaceEnrollment({
        studentId: profileStudent.id,
        consentGranted: true,
        descriptor,
        photoDataUrl: portraitDataUrl,
      });
      setProfileStudent(saved.student);
      setBioMessage(
        `Live capture enrolled (detection score ${(detectionScore * 100).toFixed(1)}%).`,
      );
      stopEnrollmentWebcam();
      await onDataChanged();
    } catch (err) {
      setBioError(err instanceof Error ? err.message : 'Webcam enrollment failed.');
      setBioMessage(null);
    } finally {
      setEnrollingBio(false);
    }
  };

  const handleRevokeBiometric = async () => {
    if (!profileStudent) return;
    setEnrollingBio(true);
    setBioError(null);
    try {
      const res = await SmartAttendService.revokeFaceEnrollment(profileStudent.id);
      setProfileStudent(res.student);
      setConsentChecked(false);
      setBioMessage('Biometric consent revoked & facial descriptor permanently deleted.');
      await onDataChanged();
    } catch (err) {
      setBioError(err instanceof Error ? err.message : 'Failed to revoke biometric data.');
    } finally {
      setEnrollingBio(false);
    }
  };

  const filteredStudents = data.students.filter((s) => {
    if (deptFilter !== 'ALL' && s.department !== deptFilter) return false;
    if (yearFilter !== 'ALL' && s.academicYear !== yearFilter) return false;
    if (sectionFilter !== 'ALL' && s.section !== sectionFilter) return false;
    if (bioFilter !== 'ALL' && s.faceEnrollmentStatus !== bioFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${s.fullName} ${s.registerNo} ${s.rollNo} ${s.admissionNo ?? ''} ${s.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const profileAttendance = profileStudent
    ? data.attendance.filter((a) => a.studentId === profileStudent.id)
    : [];
  const profilePresent = profileAttendance.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED',
  ).length;
  const profilePct =
    profileAttendance.length > 0 ? (profilePresent / profileAttendance.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
            {isAdmin ? 'Centralized Student Database' : `${lockedDepartment} Student Directory`}
          </h2>
          <p className="text-xs text-slate-600">
            Shared central repository: HOD-enrolled students synchronize immediately into the
            Administration Student Database. Supports Excel (.xlsx / .xls), CSV upload, and
            consent-verified facial enrollment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setImportSummary(null);
              setShowImportPanel((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBDCD4] bg-white px-3.5 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Excel / CSV Import</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, admission no, register no, roll no..."
            className="w-full rounded-lg border border-[#CBDCD4] bg-white py-2 pl-9 pr-3 text-xs text-[#0F1F1E] placeholder:text-slate-400 focus:border-[#10B981] focus:outline-none"
          />
        </div>
        {isAdmin && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">All Departments</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.code}>
                {d.code}
              </option>
            ))}
          </select>
        )}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
        >
          <option value="ALL">All Academic Years</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-2.5 py-2 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">Sec: All</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                Sec {s}
              </option>
            ))}
          </select>
          <select
            value={bioFilter}
            onChange={(e) => setBioFilter(e.target.value)}
            className="rounded-lg border border-[#CBDCD4] bg-white px-2.5 py-2 text-xs text-[#0F1F1E]"
          >
            <option value="ALL">Face: All</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="NOT_ENROLLED">Manual Only</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
      </div>

      {/* Excel / CSV Import Panel */}
      {showImportPanel && (
        <form
          onSubmit={handleCsvSubmit}
          className="rounded-xl border border-[#10B981]/50 bg-white p-5 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
                Bulk Student Import (Excel .xlsx / .xls or CSV)
              </h3>
              <p className="text-[11px] text-slate-600">
                Supported headers: Admission No, Register No, Roll No, Student Name, Department,
                Academic Year, Section, Email, Phone. Duplicate Register Numbers are safely skipped.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#172B2A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10201F]">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload .xlsx / .xls / .csv</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => void handleSpreadsheetUpload(e)}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            rows={4}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[#CBDCD4] bg-[#F8FCF9] p-3 font-mono text-xs text-[#0F1F1E] focus:border-[#10B981] focus:outline-none"
          />
          {importSummary && (
            <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {importSummary}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImportPanel(false)}
              className="rounded-lg border border-[#CBDCD4] px-3.5 py-1.5 text-xs text-slate-600"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-[#06281E]"
            >
              {saving ? 'Importing...' : 'Run Text CSV Import'}
            </button>
          </div>
        </form>
      )}

      {/* Add/Edit Student Form */}
      {showAddEdit && (
        <form
          onSubmit={handleSaveStudent}
          className="rounded-xl border border-[#10B981]/50 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
            {editingStudent ? `Edit Student · ${editingStudent.registerNo}` : 'Enroll New Student'}
          </h3>
          {error && (
            <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Admission No</label>
              <input
                type="text"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                placeholder="ADM-2023-104"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Register No</label>
              <input
                type="text"
                required
                disabled={Boolean(editingStudent)}
                value={registerNo}
                onChange={(e) => setRegisterNo(e.target.value)}
                placeholder="23CSE104"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Roll No</label>
              <input
                type="text"
                required
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="CS104"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Student full name"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
              <select
                disabled={!isAdmin}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E] disabled:bg-slate-50"
              >
                {data.departments.map((d) => (
                  <option key={d.id} value={d.code}>
                    {d.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Academic Year</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value as AcademicYear)}
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as SectionCode)}
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
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Enrollment Status
              </label>
              <select
                value={enrollmentStatus}
                onChange={(e) => setEnrollmentStatus(e.target.value as StudentEnrollmentStatus)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="GRADUATED">GRADUATED</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@smartattend.edu"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98400 00000"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddEdit(false)}
              className="rounded-lg border border-[#CBDCD4] px-3.5 py-1.5 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-[#06281E]"
            >
              {saving ? 'Saving...' : 'Save Student'}
            </button>
          </div>
        </form>
      )}

      {/* Student Directory Table */}
      <div className="overflow-x-auto rounded-xl border border-[#D1E7DC] bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#D1E7DC] bg-[#F8FCF9] text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Admission / Reg / Roll</th>
              <th className="px-4 py-3 font-medium">Cohort</th>
              <th className="px-4 py-3 font-medium">Face Enrollment Status</th>
              <th className="px-4 py-3 font-medium">Enrollment</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6F2EC]">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No students match the current filter criteria.
                </td>
              </tr>
            ) : (
              filteredStudents.map((stu) => (
                <tr key={stu.id} className="hover:bg-[#F8FCF9]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {stu.photoDataUrl ? (
                        <img
                          src={stu.photoDataUrl}
                          alt={stu.fullName}
                          className="h-9 w-9 rounded-lg border border-[#10B981]/50 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D1E7DC] bg-[#F0FDF4] font-mono text-xs font-semibold text-[#172B2A]">
                          {stu.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-[#172B2A]">{stu.fullName}</div>
                        <div className="text-[11px] text-slate-500">{stu.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    <div className="font-medium text-[#172B2A]">{stu.registerNo}</div>
                    <div className="text-[11px] text-slate-500">
                      Roll: {stu.rollNo} · Adm: {stu.admissionNo ?? stu.registerNo}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-[#059669]">{stu.department}</span>{' '}
                    <span className="text-slate-600">
                      · {stu.academicYear} · Sec {stu.section}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        stu.faceEnrollmentStatus === 'ENROLLED'
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stu.faceEnrollmentStatus === 'ENROLLED'
                        ? 'Consented · Enrolled'
                        : stu.faceEnrollmentStatus === 'REVOKED'
                          ? 'Revoked · Manual'
                          : 'Manual Fallback'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                    {stu.enrollmentStatus}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openProfile(stu)}
                        className="rounded border border-[#10B981] px-2.5 py-1 text-[11px] font-medium text-[#059669] hover:bg-[#10B981] hover:text-[#06281E]"
                      >
                        Profile &amp; Face
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(stu)}
                        className="rounded border border-[#CBDCD4] px-2.5 py-1 text-[11px] text-[#172B2A] hover:border-[#10B981]"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Student Profile & Biometric Consent Drawer */}
      {profileStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#0C1918]/75 backdrop-blur-xs">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-[#D1E7DC] bg-white p-6 text-[#0F1F1E]">
            <div className="flex items-start justify-between border-b border-[#D1E7DC] pb-4">
              <div className="flex items-center gap-3">
                {profileStudent.photoDataUrl ? (
                  <img
                    src={profileStudent.photoDataUrl}
                    alt={profileStudent.fullName}
                    className="h-14 w-14 rounded-xl border border-[#10B981] object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#D1E7DC] bg-[#F0FDF4] font-mono text-base font-bold text-[#172B2A]">
                    {profileStudent.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[#172B2A]">
                    {profileStudent.fullName}
                  </h3>
                  <p className="font-mono text-xs text-[#059669]">
                    {profileStudent.registerNo} · {profileStudent.department} ·{' '}
                    {profileStudent.academicYear} Sec {profileStudent.section}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopEnrollmentWebcam();
                  setProfileStudent(null);
                }}
                className="rounded p-1.5 text-slate-500 hover:text-[#172B2A]"
                aria-label="Close student profile"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="rounded-xl border border-[#D1E7DC] bg-[#F8FCF9] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Recorded Attendance Rate</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-[#059669]">
                    {profileAttendance.length > 0 ? `${profilePct.toFixed(1)}%` : 'No Sessions Yet'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  {profilePresent} attended out of {profileAttendance.length} recorded period
                  session(s).
                </p>
              </div>

              <div className="rounded-xl border border-[#D1E7DC] bg-[#F8FCF9] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
                    Authorized Biometric Face Enrollment
                  </h4>
                  <span className="font-mono text-[11px] font-semibold text-[#059669]">
                    {profileStudent.faceEnrollmentStatus}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Only 128-dimensional mathematical facial descriptors from explicitly consenting
                  students are stored. Non-consenting students remain supported via manual
                  verification.
                </p>

                <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#D1E7DC] bg-white p-3 text-xs text-[#172B2A]">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#10B981]"
                  />
                  <span>
                    I confirm explicit student consent has been granted under Policy{' '}
                    <strong>{data.settings.biometricPolicyVersion}</strong> for face template
                    extraction and attendance verification.
                  </span>
                </label>

                {bioMessage && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>{bioMessage}</span>
                  </div>
                )}

                {bioError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{bioError}</span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{enrollingBio ? 'Extracting...' : 'Upload Portrait Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={enrollingBio}
                      onChange={(e) => void handlePhotoEnrollment(e)}
                      className="hidden"
                    />
                  </label>

                  {!webcamOpen ? (
                    <button
                      type="button"
                      onClick={() => void startEnrollmentWebcam()}
                      disabled={enrollingBio}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBDCD4] bg-white px-3.5 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981]"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Capture via Webcam</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void captureWebcamEnrollment()}
                      disabled={enrollingBio}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#172B2A] px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Capture Frame &amp; Enroll</span>
                    </button>
                  )}

                  {profileStudent.faceEnrollmentStatus === 'ENROLLED' && (
                    <button
                      type="button"
                      onClick={() => void handleRevokeBiometric()}
                      disabled={enrollingBio}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Revoke &amp; Delete Template</span>
                    </button>
                  )}
                </div>

                {webcamOpen && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-[#D1E7DC] bg-[#10201F]">
                    <video
                      ref={webcamVideoRef}
                      muted
                      playsInline
                      className="aspect-video w-full object-cover"
                    />
                    <div className="flex items-center justify-between bg-[#172B2A] px-3 py-2 text-[11px] text-[#ECFDF5]">
                      <span>Ensure single frontal face in frame</span>
                      <button
                        type="button"
                        onClick={stopEnrollmentWebcam}
                        className="text-[#34D399] hover:underline"
                      >
                        Close Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
