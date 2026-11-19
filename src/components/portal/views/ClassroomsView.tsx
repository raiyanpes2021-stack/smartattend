import { useState, type FormEvent } from 'react';
import { DoorOpen, Edit3, Play, Plus } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type AcademicYear,
  type ClassroomRecord,
  type ClassroomStatus,
  type SectionCode,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';

interface ClassroomsViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
  onOpenLiveMonitoring: () => void;
}

export function ClassroomsView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
  onOpenLiveMonitoring,
}: ClassroomsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClassroomRecord | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [department, setDepartment] = useState<string>(
    lockedDepartment ?? data.departments[0]?.code ?? 'CSE',
  );
  const [academicYear, setAcademicYear] = useState<AcademicYear>('2nd Year');
  const [section, setSection] = useState<SectionCode>('A');
  const [floor, setFloor] = useState('2nd Floor');
  const [building, setBuilding] = useState('Main Block');
  const [capacity, setCapacity] = useState(60);
  const [assignedCameraId, setAssignedCameraId] = useState<string>('');
  const [status, setStatus] = useState<ClassroomStatus>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setRoomCode('');
    setRoomName('');
    setDepartment(lockedDepartment ?? data.departments[0]?.code ?? 'CSE');
    setAcademicYear('2nd Year');
    setSection('A');
    setFloor('2nd Floor');
    setBuilding('Main Block');
    setCapacity(60);
    setAssignedCameraId('');
    setStatus('ACTIVE');
    setError(null);
    setShowForm(true);
  };

  const openEdit = (room: ClassroomRecord) => {
    setEditing(room);
    setRoomCode(room.roomCode);
    setRoomName(room.roomName);
    setDepartment(room.department);
    setAcademicYear(room.academicYear);
    setSection(room.section);
    setFloor(room.floor);
    setBuilding(room.building);
    setCapacity(room.capacity);
    setAssignedCameraId(room.assignedCameraId ?? '');
    setStatus(room.status);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.upsertClassroom({
        id: editing?.id,
        roomCode,
        roomName,
        department: lockedDepartment ?? department,
        academicYear,
        section,
        floor,
        building,
        capacity,
        assignedCameraId: assignedCameraId || null,
        status,
      });
      setShowForm(false);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save classroom.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStartSession = async (room: ClassroomRecord) => {
    const subject =
      data.subjects.find(
        (s) => s.department === room.department && s.academicYear === room.academicYear,
      ) ?? data.subjects.find((s) => s.department === room.department);
    if (!subject) {
      setError(`No subject found for ${room.department}. Add a subject first.`);
      return;
    }
    try {
      await SmartAttendService.createSession({
        department: room.department,
        academicYear: room.academicYear,
        section: room.section,
        classroomId: room.id,
        cameraId: room.assignedCameraId,
        subjectId: subject.id,
        status: 'LIVE',
      });
      await onDataChanged();
      onOpenLiveMonitoring();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch live session.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#172B2A]">
            Classroom Management
          </h2>
          <p className="text-xs text-[#475569]">
            Configure lecture halls, capacities, floor locations, and assigned camera bindings.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Add Classroom</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#10B981]/35 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
            {editing ? `Edit Classroom · ${editing.roomCode}` : 'Register Classroom'}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Room Code</label>
              <input
                type="text"
                required
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="CSE-205"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Classroom Name</label>
              <input
                type="text"
                required
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room 205 · Systems Studio"
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Department</label>
              <select
                disabled={!isAdmin}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] disabled:bg-slate-100 disabled:text-slate-500 focus:border-[#10B981] focus:outline-none"
              >
                {data.departments.map((d) => (
                  <option key={d.id} value={d.code}>
                    {d.code}
                  </option>
                ))}
              </select>
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
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as SectionCode)}
                className="w-full rounded-lg border border-[#D1E7DC] bg-white px-3 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
              >
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Floor &amp; Building</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="2nd Floor"
                  className="rounded-lg border border-[#D1E7DC] bg-white px-2.5 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="Block"
                  className="rounded-lg border border-[#D1E7DC] bg-white px-2.5 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#172B2A]">Capacity &amp; Camera</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="rounded-lg border border-[#D1E7DC] bg-white px-2.5 py-2 font-mono text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                />
                <select
                  value={assignedCameraId}
                  onChange={(e) => setAssignedCameraId(e.target.value)}
                  className="rounded-lg border border-[#D1E7DC] bg-white px-2 py-2 text-xs text-[#172B2A] focus:border-[#10B981] focus:outline-none"
                >
                  <option value="">No Camera</option>
                  {data.cameras
                    .filter(
                      (c) =>
                        c.department === department ||
                        (c.isSharedLab && c.authorizedDepartments.includes(department)),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cameraNumber || c.cameraCode} ({c.cameraCode})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClassroomStatus)}
              className="rounded-lg border border-[#D1E7DC] bg-white px-3 py-1.5 text-xs text-[#172B2A]"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-[#D1E7DC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#059669]"
              >
                {saving ? 'Saving...' : 'Save Classroom'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.classrooms.map((room) => {
          const cam = data.cameras.find((c) => c.id === room.assignedCameraId);
          return (
            <div
              key={room.id}
              className="flex flex-col justify-between rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-[#10B981]" aria-hidden="true" />
                    <span className="font-mono text-xs font-bold text-[#059669]">
                      {room.roomCode}
                    </span>
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      room.status === 'ACTIVE'
                        ? 'border-[#10B981]/35 bg-[#ECFDF5] text-[#065F46]'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {room.status}
                  </span>
                </div>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-sm font-bold text-[#172B2A]">
                  {room.roomName}
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  {room.department} · {room.academicYear} · Section {room.section}
                </p>
                <div className="mt-3 space-y-1 border-t border-[#E2EFE8] pt-2.5 text-[11px] text-[#475569]">
                  <div>
                    Location: {room.floor}, {room.building} · Capacity{' '}
                    <span className="font-mono font-semibold tabular-nums text-[#172B2A]">
                      {room.capacity}
                    </span>
                  </div>
                  <div>
                    Camera:{' '}
                    <span className="font-mono font-semibold text-[#059669]">
                      {cam
                        ? `${cam.cameraNumber || cam.cameraCode} (${cam.online ? 'Ready' : 'Offline'})`
                        : 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#E2EFE8] pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(room)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D1E7DC] bg-white px-2.5 py-1 text-[11px] font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                >
                  <Edit3 className="h-3 w-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickStartSession(room)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#172B2A] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#10B981]"
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  <span>Start Live Session</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
