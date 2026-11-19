import { useState, type FormEvent } from 'react';
import { AlertCircle, Camera, Edit3, Plus, Power } from 'lucide-react';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type AcademicYear,
  type CameraRecord,
  type CameraSourceType,
  type SectionCode,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';

interface CamerasViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
}

export function CamerasView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
}: CamerasViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CameraRecord | null>(null);
  const [cameraCode, setCameraCode] = useState('');
  const [cameraNumber, setCameraNumber] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<string>(
    lockedDepartment ?? data.departments[0]?.code ?? 'CSE',
  );
  const [academicYear, setAcademicYear] = useState<AcademicYear | 'COMMON'>('2nd Year');
  const [section, setSection] = useState<SectionCode | 'COMMON'>('A');
  const [isSharedLab, setIsSharedLab] = useState(false);
  const [authorizedDepartments, setAuthorizedDepartments] = useState<string[]>([
    lockedDepartment ?? 'CSE',
  ]);
  const [classroomId, setClassroomId] = useState('');
  const [sourceType, setSourceType] = useState<CameraSourceType>('WEBCAM');
  const [connectionLabel, setConnectionLabel] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    const defaultDept = lockedDepartment ?? data.departments[0]?.code ?? 'CSE';
    setEditing(null);
    setCameraCode('');
    setCameraNumber(`CAMERA ${String(data.cameras.length + 1).padStart(2, '0')}`);
    setName('');
    setDepartment(defaultDept);
    setAcademicYear('2nd Year');
    setSection('A');
    setIsSharedLab(false);
    setAuthorizedDepartments([defaultDept]);
    setClassroomId('');
    setSourceType('WEBCAM');
    setConnectionLabel('');
    setGatewayUrl('');
    setError(null);
    setShowForm(true);
  };

  const openEdit = (cam: CameraRecord) => {
    setEditing(cam);
    setCameraCode(cam.cameraCode);
    setCameraNumber(cam.cameraNumber || 'CAMERA 01');
    setName(cam.name);
    setDepartment(cam.department);
    setAcademicYear(cam.academicYear || '2nd Year');
    setSection(cam.section || 'A');
    setIsSharedLab(Boolean(cam.isSharedLab));
    setAuthorizedDepartments(
      cam.authorizedDepartments?.length ? cam.authorizedDepartments : [cam.department],
    );
    setClassroomId(cam.classroomId ?? '');
    setSourceType(cam.sourceType);
    setConnectionLabel(cam.connectionLabel);
    setGatewayUrl(cam.gatewayUrl);
    setError(null);
    setShowForm(true);
  };

  const toggleAuthorizedDept = (code: string) => {
    setAuthorizedDepartments((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((d) => d !== code)
          : prev
        : [...prev, code],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await SmartAttendService.upsertCamera({
        id: editing?.id,
        cameraCode,
        cameraNumber,
        name,
        department: lockedDepartment ?? department,
        academicYear,
        section,
        isSharedLab: isAdmin ? isSharedLab : editing?.isSharedLab,
        authorizedDepartments: isAdmin
          ? isSharedLab
            ? authorizedDepartments
            : [lockedDepartment ?? department]
          : undefined,
        classroomId: classroomId || null,
        sourceType,
        connectionLabel,
        gatewayUrl,
        online: sourceType === 'RTSP_GATEWAY' ? Boolean(gatewayUrl.trim()) : true,
        lastError:
          sourceType === 'RTSP_GATEWAY' && !gatewayUrl.trim()
            ? 'Gateway bridge URL not configured; raw RTSP cannot stream directly in browser.'
            : null,
      });
      setShowForm(false);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save camera.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnline = async (cam: CameraRecord) => {
    try {
      await SmartAttendService.upsertCamera({
        id: cam.id,
        cameraCode: cam.cameraCode,
        name: cam.name,
        department: cam.department,
        sourceType: cam.sourceType,
        online: !cam.online,
        monitoringActive: !cam.online ? cam.monitoringActive : false,
      });
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle camera.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#172B2A]">
            Classroom Camera Registry &amp; Shared Lab Permissions
          </h2>
          <p className="text-xs text-slate-600">
            Configure classroom cameras, shared campus laboratory authorizations, and RTSP media
            gateway bindings.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Register Camera</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#10B981]/50 bg-white p-5 shadow-xs"
        >
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
            {editing ? `Edit Camera · ${editing.cameraCode}` : 'Register Classroom Camera'}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Camera Number
              </label>
              <input
                type="text"
                required
                value={cameraNumber}
                onChange={(e) => setCameraNumber(e.target.value.toUpperCase())}
                placeholder="CAMERA 01"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Camera ID / Code</label>
              <input
                type="text"
                required
                value={cameraCode}
                onChange={(e) => setCameraCode(e.target.value)}
                placeholder="CAM-CSE-301"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 font-mono text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Camera Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Room 301 Front Camera"
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Owner Dept</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Year &amp; Section</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value as AcademicYear | 'COMMON')}
                  className="rounded-lg border border-[#CBDCD4] bg-white px-2 py-2 text-xs text-[#0F1F1E]"
                >
                  <option value="COMMON">COMMON</option>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value as SectionCode | 'COMMON')}
                  className="rounded-lg border border-[#CBDCD4] bg-white px-2 py-2 text-xs text-[#0F1F1E]"
                >
                  <option value="COMMON">COMMON</option>
                  {SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      Sec {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Source Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as CameraSourceType)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              >
                <option value="WEBCAM">Browser Webcam (getUserMedia)</option>
                <option value="DEMO_VIDEO">Uploaded Demo Classroom Video</option>
                <option value="RTSP_GATEWAY">IP / RTSP CCTV via Media Gateway</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Assigned Classroom
              </label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              >
                <option value="">Unassigned</option>
                {data.classrooms
                  .filter((r) => isAdmin || r.department === department)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomCode} · {r.roomName}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {sourceType === 'RTSP_GATEWAY' ? 'Gateway HLS/MP4 Bridge URL' : 'Connection Label'}
              </label>
              <input
                type="text"
                value={sourceType === 'RTSP_GATEWAY' ? gatewayUrl : connectionLabel}
                onChange={(e) =>
                  sourceType === 'RTSP_GATEWAY'
                    ? setGatewayUrl(e.target.value)
                    : setConnectionLabel(e.target.value)
                }
                placeholder={
                  sourceType === 'RTSP_GATEWAY'
                    ? 'https://gateway.campus.local/live/stream.m3u8'
                    : 'USB / Built-in Classroom Feed'
                }
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="mt-4 rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-3 text-xs">
              <label className="flex cursor-pointer items-center gap-2 font-medium text-[#172B2A]">
                <input
                  type="checkbox"
                  checked={isSharedLab}
                  onChange={(e) => setIsSharedLab(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#10B981]"
                />
                <span>Common / Shared Laboratory Camera (Grant explicit HOD department access)</span>
              </label>
              {isSharedLab && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {data.departments.map((d) => {
                    const checked = authorizedDepartments.includes(d.code);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleAuthorizedDept(d.code)}
                        className={`rounded border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          checked
                            ? 'border-[#10B981] bg-[#10B981] text-[#06281E]'
                            : 'border-[#CBDCD4] bg-white text-slate-600'
                        }`}
                      >
                        {d.code}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-[#CBDCD4] px-3.5 py-1.5 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-[#06281E]"
            >
              {saving ? 'Saving...' : 'Save Camera'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.cameras.map((cam) => {
          const room = data.classrooms.find((r) => r.id === cam.classroomId);
          return (
            <div
              key={cam.id}
              className="rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D1E7DC] bg-[#F0FDF4] text-[#059669]">
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#172B2A]">
                        {cam.cameraNumber || 'CAMERA'} · {cam.cameraCode}
                      </span>
                      <span className="rounded border border-[#D1E7DC] bg-[#F8FCF9] px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {cam.sourceType === 'DEMO_VIDEO'
                          ? 'DEMO VIDEO FEED'
                          : cam.sourceType === 'RTSP_GATEWAY'
                            ? 'RTSP GATEWAY'
                            : 'BROWSER WEBCAM'}
                      </span>
                      {cam.isSharedLab && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                          SHARED LAB
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
                      {cam.name}
                    </h3>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    cam.online
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  {cam.online ? 'Ready' : 'Offline'}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <div>
                  Department: <strong className="text-[#172B2A]">{cam.department}</strong> ·
                  Cohort:{' '}
                  <strong className="text-[#172B2A]">
                    {cam.academicYear} Sec {cam.section}
                  </strong>{' '}
                  · Room:{' '}
                  <strong className="font-mono text-[#172B2A]">
                    {room ? room.roomCode : 'Unassigned'}
                  </strong>
                </div>
                {cam.isSharedLab && (
                  <div>
                    Authorized Departments:{' '}
                    <span className="font-mono font-semibold text-[#059669]">
                      {cam.authorizedDepartments.join(', ')}
                    </span>
                  </div>
                )}
                <div className="truncate font-mono text-[11px] text-slate-500">
                  {cam.gatewayUrl || cam.connectionLabel}
                </div>
              </div>

              {cam.lastError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{cam.lastError}</span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-[#E6F2EC] pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(cam)}
                  className="inline-flex items-center gap-1 rounded border border-[#CBDCD4] px-2.5 py-1 text-[11px] text-[#172B2A] hover:border-[#10B981]"
                >
                  <Edit3 className="h-3 w-3" aria-hidden="true" />
                  <span>Configure</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleOnline(cam)}
                  className="inline-flex items-center gap-1 rounded border border-[#10B981] px-3 py-1 text-[11px] font-medium text-[#059669] hover:bg-[#10B981] hover:text-[#06281E]"
                >
                  <Power className="h-3 w-3" aria-hidden="true" />
                  <span>{cam.online ? 'Set Offline' : 'Set Ready'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
