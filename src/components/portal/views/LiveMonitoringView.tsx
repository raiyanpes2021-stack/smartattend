import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Cpu,
  FileVideo,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Square,
  Upload,
  UserCheck,
  VideoOff,
} from 'lucide-react';
import {
  analyzeVideoFrame,
  createLivenessTrackerState,
  ensureCvModelsLoaded,
  isCvEngineReady,
  type DetectedFaceResult,
  type EnrolledTemplateItem,
} from '../../../services/FaceVisionEngine';
import {
  detectFacesWithMediaPipe,
  ensureMediaPipeFaceDetector,
  type MediaPipeDetectedFace,
  type MediaPipeDetectorState,
} from '../../../services/MediaPipeDetector';
import { SmartAttendService } from '../../../services/SmartAttendService';
import type { DepartmentCode } from '../../../types/auth';
import {
  ACADEMIC_YEARS,
  SECTIONS,
  type AcademicYear,
  type AttendanceStatus,
  type CameraSourceType,
  type SectionCode,
  type WorkspaceBootstrapData,
} from '../../../types/smartattend';
import { resolveCurrentTimetableContext } from '../../../utils/timetableResolver';

interface LiveMonitoringViewProps {
  data: WorkspaceBootstrapData;
  isAdmin: boolean;
  lockedDepartment?: DepartmentCode | null;
  onDataChanged: () => Promise<void>;
}

type RosterFilter = 'ALL' | 'PRESENT' | 'ABSENT' | 'UNKNOWN' | 'PENDING_VERIFICATION';

export function LiveMonitoringView({
  data,
  isAdmin,
  lockedDepartment,
  onDataChanged,
}: LiveMonitoringViewProps) {
  const [selectedDept, setSelectedDept] = useState<string>(
    lockedDepartment ?? data.departments[0]?.code ?? 'CSE',
  );
  const [selectedYear, setSelectedYear] = useState<AcademicYear>('2nd Year');
  const [selectedSection, setSelectedSection] = useState<SectionCode>('A');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('ALL');

  // Clock tick for live dynamic timetable resolution
  const [clockTick, setClockTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Create session inline drawer
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState('');

  // Hardware camera enumeration & input mode state
  const [feedMode, setFeedMode] = useState<CameraSourceType>('WEBCAM');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(null);
  const [demoVideoName, setDemoVideoName] = useState<string>('');
  const [demoPaused, setDemoPaused] = useState(false);
  const [feedActive, setFeedActive] = useState(false);

  // Explicit separation: MediaPipe Face Detection vs. AI Face Recognition
  const [mediaPipeState, setMediaPipeState] = useState<MediaPipeDetectorState>('NOT_LOADED');
  const [mediaPipeDelegate, setMediaPipeDelegate] = useState<'GPU' | 'CPU'>('GPU');
  const [detectedFacesCount, setDetectedFacesCount] = useState(0);
  const [mediaPipeFaces, setMediaPipeFaces] = useState<MediaPipeDetectedFace[]>([]);

  const [recognitionActive, setRecognitionActive] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<string>(
    isCvEngineReady() ? 'Recognition Model Ready' : 'Standby (Start for Biometric Match)',
  );
  const [cvError, setCvError] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<DetectedFaceResult[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const demoInputRef = useRef<HTMLInputElement | null>(null);
  const livenessTrackerRef = useRef(createLivenessTrackerState());
  const lastLoggedAtRef = useRef<Map<string, number>>(new Map());
  const recognitionOverlaysRef = useRef<DetectedFaceResult[]>([]);

  // Visible cameras (includes owned dept + authorized shared labs)
  const visibleCameras = useMemo(
    () =>
      data.cameras.filter(
        (c) =>
          c.department === selectedDept ||
          (c.isSharedLab && c.authorizedDepartments.includes(selectedDept)),
      ),
    [data.cameras, selectedDept],
  );

  const activeCamera = useMemo(() => {
    const explicit = visibleCameras.find((c) => c.id === selectedCameraId);
    if (explicit) return explicit;
    if (selectedClassroomId) {
      const bound = visibleCameras.find((c) => c.classroomId === selectedClassroomId);
      if (bound) return bound;
    }
    return visibleCameras[0] ?? null;
  }, [visibleCameras, selectedCameraId, selectedClassroomId]);

  const deptClassrooms = useMemo(
    () => data.classrooms.filter((c) => c.department === selectedDept),
    [data.classrooms, selectedDept],
  );

  const matchingClassrooms = useMemo(
    () =>
      data.classrooms.filter(
        (c) =>
          c.department === selectedDept &&
          c.academicYear === selectedYear &&
          c.section === selectedSection,
      ),
    [data.classrooms, selectedDept, selectedYear, selectedSection],
  );

  const activeClassroom = useMemo(() => {
    if (activeCamera?.classroomId) {
      const bound = data.classrooms.find((c) => c.id === activeCamera.classroomId);
      if (bound) return bound;
    }
    const chosen = data.classrooms.find((c) => c.id === selectedClassroomId);
    if (chosen) return chosen;
    return matchingClassrooms[0] ?? deptClassrooms[0] ?? null;
  }, [activeCamera, data.classrooms, selectedClassroomId, matchingClassrooms, deptClassrooms]);

  // Dynamic Timetable Context resolved from saved timetable + institutional timezone
  const timetableContext = useMemo(
    () => {
      void clockTick;
      return resolveCurrentTimetableContext({
        department: selectedDept,
        academicYear:
          activeCamera?.academicYear && activeCamera.academicYear !== 'COMMON'
            ? activeCamera.academicYear
            : selectedYear,
        section:
          activeCamera?.section && activeCamera.section !== 'COMMON'
            ? activeCamera.section
            : selectedSection,
        classroomId: activeClassroom?.id ?? null,
        timezone: data.settings.institutionTimezone,
        periods: data.timetablePeriods,
        holidays: data.holidays,
        overrides: data.timetableOverrides,
      });
    },
    [
      clockTick,
      selectedDept,
      activeCamera,
      selectedYear,
      selectedSection,
      activeClassroom,
      data.settings.institutionTimezone,
      data.timetablePeriods,
      data.holidays,
      data.timetableOverrides,
    ],
  );

  const matchingSessions = useMemo(
    () =>
      data.sessions.filter(
        (s) =>
          s.department === selectedDept &&
          s.academicYear === selectedYear &&
          s.section === selectedSection,
      ),
    [data.sessions, selectedDept, selectedYear, selectedSection],
  );

  const activeSession = useMemo(() => {
    const explicit = data.sessions.find((s) => s.id === selectedSessionId);
    if (explicit && explicit.department === selectedDept) return explicit;
    return (
      matchingSessions.find((s) => s.status === 'LIVE') ??
      matchingSessions[0] ??
      data.sessions.find((s) => s.department === selectedDept && s.status === 'LIVE') ??
      null
    );
  }, [data.sessions, selectedSessionId, selectedDept, matchingSessions]);

  const enrolledTemplates = useMemo<EnrolledTemplateItem[]>(() => {
    const items: EnrolledTemplateItem[] = [];
    for (const fe of data.faceEnrollments) {
      if (fe.status !== 'ACTIVE' || !fe.consentGranted || fe.descriptor.length !== 128) {
        continue;
      }
      const stu = data.students.find(
        (s) =>
          s.id === fe.studentId &&
          s.department === selectedDept &&
          s.enrollmentStatus === 'ACTIVE',
      );
      if (stu) {
        items.push({
          student: stu,
          enrollment: fe,
          descriptorFloat32: new Float32Array(fe.descriptor),
        });
      }
    }
    return items;
  }, [data.faceEnrollments, data.students, selectedDept]);

  // Enumerate connected camera devices safely
  const refreshVideoDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter((d) => d.kind === 'videoinput');
      setVideoDevices(cams);
      if (!selectedDeviceId && cams[0]?.deviceId) {
        setSelectedDeviceId(cams[0].deviceId);
      }
    } catch {
      // ignore enumeration errors until getUserMedia grants labels
    }
  };

  useEffect(() => {
    void refreshVideoDevices();
  }, []);

  const clearOverlayCanvas = () => {
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const stopFeed = () => {
    setRecognitionActive(false);
    setFeedActive(false);
    setDemoPaused(false);
    setDetectedFacesCount(0);
    setMediaPipeFaces([]);
    setLiveDetections([]);
    recognitionOverlaysRef.current = [];
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    clearOverlayCanvas();
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (demoVideoUrl) URL.revokeObjectURL(demoVideoUrl);
    };
  }, [demoVideoUrl]);

  const initMediaPipe = async (): Promise<boolean> => {
    setMediaPipeState('MODEL LOADING');
    try {
      await ensureMediaPipeFaceDetector();
      setMediaPipeState('MODEL READY');
      return true;
    } catch (err) {
      setMediaPipeState('DETECTION ERROR');
      setCvError(
        err instanceof Error
          ? err.message
          : 'MediaPipe BlazeFace model failed to initialize.',
      );
      return false;
    }
  };

  const handleStartLiveWebcam = async () => {
    stopFeed();
    setCvError(null);
    setActionMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCvError(
        'Browser camera access (getUserMedia) is unavailable in this iframe/browser context. Switch to Classroom Demo Video Mode.',
      );
      return;
    }

    const ok = await initMediaPipe();
    if (!ok) return;

    try {
      const videoConstraints: MediaTrackConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      mediaStreamRef.current = stream;
      setFeedMode('WEBCAM');
      setFeedActive(true);
      await refreshVideoDevices();

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            setCvError('Unable to start webcam video playback.');
          });
        }
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCvError(
          'Camera permission was denied. Allow camera access in your browser/site settings or switch to Classroom Demo Video Mode.',
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCvError(
          'No physical camera device was found on this workstation. Connect a webcam or use Classroom Demo Video Mode.',
        );
      } else {
        setCvError(err instanceof Error ? err.message : 'Unable to start camera stream.');
      }
      setFeedActive(false);
    }
  };

  const handleDemoVideoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvError(null);
    setActionMessage(null);

    const ext = file.name.toLowerCase();
    const supported =
      file.type.startsWith('video/mp4') ||
      file.type.startsWith('video/webm') ||
      ext.endsWith('.mp4') ||
      ext.endsWith('.webm') ||
      file.type.startsWith('video/');

    if (!supported) {
      setCvError('Unsupported video file format. Upload a browser-playable MP4 or WebM video.');
      e.target.value = '';
      return;
    }

    stopFeed();
    const ok = await initMediaPipe();
    if (!ok) return;

    if (demoVideoUrl) URL.revokeObjectURL(demoVideoUrl);
    const url = URL.createObjectURL(file);
    setDemoVideoUrl(url);
    setDemoVideoName(file.name);
    setFeedMode('DEMO_VIDEO');
    setFeedActive(true);
    setDemoPaused(false);

    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        void videoRef.current.play().catch(() => {
          setCvError('The uploaded video codec could not be decoded by this browser. Try standard H.264 MP4 or VP8/VP9 WebM.');
          stopFeed();
        });
      }
    });
    e.target.value = '';
  };

  const handleDemoPlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setDemoPaused(false);
    } else {
      video.pause();
      setDemoPaused(true);
    }
  };

  const handleDemoRestart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play();
    setDemoPaused(false);
  };

  // Continuous Real MediaPipe Face Detection Loop (both Live Webcam and Demo Video)
  useEffect(() => {
    if (!feedActive) return;
    let rafId = 0;
    let cancelled = false;
    let lastTimestamp = -1;

    const renderLoop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
        const nowTs = Math.max(lastTimestamp + 1, performance.now());
        lastTimestamp = nowTs;
        const mpResult = detectFacesWithMediaPipe(video, nowTs);
        setMediaPipeState(mpResult.state);
        setMediaPipeDelegate(mpResult.delegate);
        setDetectedFacesCount(mpResult.faces.length);
        setMediaPipeFaces(mpResult.faces);
        if (mpResult.errorMessage) {
          setCvError(mpResult.errorMessage);
        }

        // Draw synchronized canvas bounding boxes (MediaPipe detection + Recognition labels if active)
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 1. Draw MediaPipe real-time detection boxes
          for (const face of mpResult.faces) {
            ctx.strokeStyle = feedMode === 'DEMO_VIDEO' ? '#F59E0B' : '#10B981';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(face.originX, face.originY, face.width, face.height);

            const badge = `Face ${Math.round(face.confidence * 100)}%`;
            ctx.font = '600 12px "Manrope", sans-serif';
            const textW = Math.max(ctx.measureText(badge).width + 14, 96);
            const labelY = Math.max(0, face.originY - 24);
            ctx.fillStyle = 'rgba(23, 43, 42, 0.9)';
            ctx.fillRect(face.originX, labelY, textW, 22);
            ctx.fillStyle = feedMode === 'DEMO_VIDEO' ? '#FCD34D' : '#34D399';
            ctx.fillText(badge, face.originX + 7, labelY + 15);
          }

          // 2. Overlay biometric match identity tags when Face Recognition is running in LIVE WEBCAM mode
          if (recognitionActive && feedMode !== 'DEMO_VIDEO') {
            for (const det of recognitionOverlaysRef.current) {
              const isMatched = det.outcome === 'MATCHED_PRESENT';
              const tag = det.matchedStudent
                ? `${det.matchedStudent.fullName} · ${Math.round(det.confidence * 100)}% (${det.outcome === 'MATCHED_PRESENT' ? 'PRESENT' : 'PENDING'})`
                : `Unenrolled Face`;
              ctx.font = '600 11px "Manrope", sans-serif';
              const tagW = Math.max(ctx.measureText(tag).width + 14, 130);
              const tagY = det.box.y + det.box.height + 4;
              ctx.fillStyle = isMatched ? 'rgba(6, 40, 30, 0.92)' : 'rgba(23, 43, 42, 0.9)';
              ctx.fillRect(det.box.x, tagY, tagW, 22);
              ctx.fillStyle = isMatched ? '#34D399' : '#FFFFFF';
              ctx.fillText(tag, det.box.x + 7, tagY + 15);
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [feedActive, feedMode, recognitionActive]);

  // Separate Throttled Biometric Face Recognition Loop (ONLY saves attendance in LIVE WEBCAM / Gateway mode)
  useEffect(() => {
    if (!recognitionActive || !feedActive || feedMode === 'DEMO_VIDEO') return;
    let cancelled = false;

    const runBiometricCycle = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const results = await analyzeVideoFrame(
          videoRef.current,
          enrolledTemplates,
          {
            highConfidence: data.settings.highConfidenceThreshold,
            pendingConfidence: data.settings.pendingConfidenceThreshold,
          },
          livenessTrackerRef.current,
        );
        if (cancelled) return;
        recognitionOverlaysRef.current = results;
        setLiveDetections(results);
        setRecognitionStatus(`Biometric Matching Active · ${enrolledTemplates.length} Enrolled`);

        if (activeSession && activeSession.status !== 'FINALIZED') {
          const nowMs = Date.now();
          let anyLogged = false;
          for (const det of results) {
            const throttleKey = det.matchedStudent
              ? det.matchedStudent.id
              : `unknown-${det.outcome}`;
            const prevTime = lastLoggedAtRef.current.get(throttleKey) ?? 0;
            if (nowMs - prevTime < 8000) continue;
            lastLoggedAtRef.current.set(throttleKey, nowMs);

            await SmartAttendService.logRecognitionEvent({
              sessionId: activeSession.id,
              cameraId: activeCamera?.id ?? 'cam-browser',
              matchedStudentId: det.matchedStudent?.id ?? null,
              confidence: det.confidence,
              livenessStatus: det.livenessStatus,
              outcome: det.outcome,
            });
            anyLogged = true;
          }
          if (anyLogged) {
            await onDataChanged();
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCvError(err instanceof Error ? err.message : 'Biometric matching error.');
          setRecognitionActive(false);
        }
      }
    };

    void runBiometricCycle();
    const interval = window.setInterval(() => {
      void runBiometricCycle();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    recognitionActive,
    feedActive,
    feedMode,
    enrolledTemplates,
    data.settings.highConfidenceThreshold,
    data.settings.pendingConfidenceThreshold,
    activeSession,
    activeCamera,
    onDataChanged,
  ]);

  const handleToggleRecognition = async () => {
    if (feedMode === 'DEMO_VIDEO') {
      setCvError(
        'Demo Video Mode runs real MediaPipe Face Detection for demonstration only. Biometric attendance saving is disabled in Demo Video Mode.',
      );
      return;
    }
    if (recognitionActive) {
      setRecognitionActive(false);
      recognitionOverlaysRef.current = [];
      setRecognitionStatus('Biometric Recognition Paused');
      return;
    }
    if (!activeSession) {
      setCvError(
        'Select or start a Class Session above before saving biometric attendance records.',
      );
      return;
    }
    if (!feedActive) {
      await handleStartLiveWebcam();
    }
    setRecognitionStatus('Loading 128-d Face Recognition Weights...');
    try {
      await ensureCvModelsLoaded();
      setRecognitionStatus('Biometric Recognition Ready');
      setRecognitionActive(true);
    } catch (err) {
      setCvError(err instanceof Error ? err.message : 'Failed to load biometric recognition models.');
      setRecognitionStatus('Recognition Init Error');
    }
  };

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeClassroom) return;
    const subjectId =
      newSubjectId ||
      timetableContext.subjectId ||
      data.subjects.find((s) => s.department === selectedDept)?.id ||
      '';
    try {
      const res = await SmartAttendService.createSession({
        department: selectedDept,
        academicYear: selectedYear,
        section: selectedSection,
        classroomId: activeClassroom.id,
        cameraId: activeCamera?.id ?? null,
        subjectId: subjectId || undefined,
        periodNumber: timetableContext.periodNumber ?? undefined,
        periodLabel: timetableContext.periodLabel,
        status: 'LIVE',
      });
      setSelectedSessionId(res.session.id);
      setShowNewSession(false);
      setActionMessage(
        `Started LIVE session (${res.session.periodLabel}) for ${selectedDept} ${selectedYear} Sec ${selectedSection}.`,
      );
      await onDataChanged();
    } catch (err) {
      setCvError(err instanceof Error ? err.message : 'Failed to start class session.');
    }
  };

  const handleFinalizeSession = async () => {
    if (!activeSession) return;
    try {
      const res = await SmartAttendService.finalizeSession(activeSession.id);
      setRecognitionActive(false);
      setActionMessage(
        `Session finalized. ${res.newlyMarkedAbsent} unmarked student(s) marked ABSENT.`,
      );
      await onDataChanged();
    } catch (err) {
      setCvError(err instanceof Error ? err.message : 'Unable to finalize session.');
    }
  };

  const handleManualMark = async (
    studentId: string,
    status: AttendanceStatus,
    reason?: string,
  ) => {
    if (feedMode === 'DEMO_VIDEO') {
      setCvError('Attendance writes are blocked while Demo Video Mode is active.');
      return;
    }
    if (!activeSession) return;
    try {
      await SmartAttendService.markAttendance({
        sessionId: activeSession.id,
        studentId,
        status,
        verificationSource: 'MANUAL',
        correctionReason: reason ?? null,
      });
      await onDataChanged();
    } catch (err) {
      setCvError(err instanceof Error ? err.message : 'Unable to update student attendance.');
    }
  };

  // Cohort roster & counts
  const cohortStudents = useMemo(
    () =>
      data.students.filter(
        (s) =>
          s.enrollmentStatus === 'ACTIVE' &&
          s.department === selectedDept &&
          s.academicYear === selectedYear &&
          s.section === selectedSection,
      ),
    [data.students, selectedDept, selectedYear, selectedSection],
  );

  const sessionAttendanceMap = useMemo(() => {
    const map = new Map<string, (typeof data.attendance)[number]>();
    if (!activeSession) return map;
    for (const rec of data.attendance) {
      if (rec.sessionId === activeSession.id) {
        map.set(rec.studentId, rec);
      }
    }
    return map;
  }, [data.attendance, activeSession]);

  const sessionEvents = useMemo(
    () =>
      activeSession
        ? data.recognitionEvents.filter((e) => e.sessionId === activeSession.id)
        : [],
    [data.recognitionEvents, activeSession],
  );
  const unknownEvents = sessionEvents.filter((e) => e.outcome === 'UNKNOWN');

  let presentCount = 0;
  let absentCount = 0;
  let pendingCount = 0;
  for (const stu of cohortStudents) {
    const rec = sessionAttendanceMap.get(stu.id);
    if (!rec) continue;
    if (
      rec.status === 'PRESENT' ||
      rec.status === 'LATE' ||
      rec.status === 'EXCUSED' ||
      rec.status === 'MANUALLY_CORRECTED'
    ) {
      presentCount += 1;
    } else if (rec.status === 'ABSENT') {
      absentCount += 1;
    } else if (rec.status === 'PENDING_VERIFICATION') {
      pendingCount += 1;
    }
  }

  const filteredRoster = cohortStudents.filter((stu) => {
    const rec = sessionAttendanceMap.get(stu.id);
    if (rosterFilter === 'ALL') return true;
    if (rosterFilter === 'PRESENT') {
      return (
        rec?.status === 'PRESENT' ||
        rec?.status === 'LATE' ||
        rec?.status === 'EXCUSED' ||
        rec?.status === 'MANUALLY_CORRECTED'
      );
    }
    if (rosterFilter === 'ABSENT') return rec?.status === 'ABSENT';
    if (rosterFilter === 'PENDING_VERIFICATION') return rec?.status === 'PENDING_VERIFICATION';
    return false;
  });

  // Genuine Live/Demo/Offline stream badge derived from REAL video state
  const genuineCameraBadge =
    feedActive && feedMode === 'WEBCAM'
      ? { label: 'LIVE', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' }
      : feedActive && feedMode === 'DEMO_VIDEO'
        ? { label: 'DEMO', cls: 'border-amber-300 bg-amber-50 text-amber-800' }
        : feedActive && feedMode === 'RTSP_GATEWAY'
          ? { label: 'LIVE', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' }
          : { label: 'OFFLINE', cls: 'border-slate-300 bg-slate-100 text-slate-600' };

  return (
    <div className="space-y-5">
      {/* Camera Cards Grid (CAMERA 01..N with Dynamic Timetable Subject Context) */}
      <section className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D1E7DC] pb-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[#172B2A]">
              Classroom &amp; Live Camera Feeds ({selectedDept})
            </h2>
            <p className="text-xs text-slate-600">
              Select a classroom camera to monitor with MediaPipe Face Detection &amp; live timetable
              context.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] px-3 py-1.5 font-mono text-[#172B2A]">
              <Clock className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
              <span>
                {timetableContext.dateStr} · {timetableContext.timeStr} ({timetableContext.dayOfWeek})
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCameras.map((cam) => {
            const isSelected = activeCamera?.id === cam.id;
            const camRoom = data.classrooms.find((r) => r.id === cam.classroomId);
            const camContext = resolveCurrentTimetableContext({
              department: cam.department,
              academicYear:
                cam.academicYear && cam.academicYear !== 'COMMON'
                  ? cam.academicYear
                  : camRoom?.academicYear ?? selectedYear,
              section:
                cam.section && cam.section !== 'COMMON'
                  ? cam.section
                  : camRoom?.section ?? selectedSection,
              classroomId: cam.classroomId,
              timezone: data.settings.institutionTimezone,
              periods: data.timetablePeriods,
              holidays: data.holidays,
              overrides: data.timetableOverrides,
            });
            const badge =
              isSelected && feedActive
                ? genuineCameraBadge
                : { label: 'OFFLINE', cls: 'border-slate-200 bg-slate-100 text-slate-600' };

            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => {
                  stopFeed();
                  setSelectedCameraId(cam.id);
                  if (cam.classroomId) setSelectedClassroomId(cam.classroomId);
                  if (cam.academicYear && cam.academicYear !== 'COMMON') {
                    setSelectedYear(cam.academicYear);
                  }
                  if (cam.section && cam.section !== 'COMMON') {
                    setSelectedSection(cam.section);
                  }
                }}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-[#10B981] bg-[#F0FDF4]'
                    : 'border-[#D1E7DC] bg-white hover:border-[#10B981]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#172B2A]">
                      {cam.cameraNumber || cam.cameraCode}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      ({cam.cameraCode})
                    </span>
                  </div>
                  <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="mt-1.5 text-sm font-semibold text-[#172B2A]">{cam.name}</div>
                <div className="mt-1 text-[11px] text-slate-600">
                  Room: <strong className="font-mono">{camRoom?.roomCode ?? 'Unbound'}</strong> ·{' '}
                  {cam.isSharedLab
                    ? `Shared Lab (${cam.authorizedDepartments.join(', ')})`
                    : `${cam.department} · ${cam.academicYear} Sec ${cam.section}`}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-[#D1E7DC] bg-white px-2.5 py-2 text-[11px]">
                  <div>
                    <span className="block text-[10px] text-slate-500">Current Period</span>
                    <span className="font-mono font-semibold text-[#172B2A]">
                      {camContext.periodLabel}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Subject / Faculty</span>
                    <span className="block truncate font-medium text-[#059669]">
                      {camContext.subjectName}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Faculty: {camContext.facultyName}</span>
                  <span className="font-mono font-semibold text-[#172B2A]">
                    Faces: {isSelected ? detectedFacesCount : 0}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cohort & Active Session Toolbar */}
      <section className="rounded-xl border border-[#D1E7DC] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D1E7DC] pb-3">
          <div className="text-xs">
            <span className="font-mono font-semibold text-[#059669]">
              {selectedDept} &rarr; {selectedYear} &rarr; Section {selectedSection} &rarr;{' '}
              {activeClassroom?.roomCode ?? 'No Room'}
            </span>
            <div className="mt-0.5 text-[11px] text-slate-600">
              Timetable Slot: <strong>{timetableContext.periodLabel}</strong> —{' '}
              {timetableContext.subjectCode ? `${timetableContext.subjectCode} · ` : ''}
              <strong>{timetableContext.subjectName}</strong> ({timetableContext.facultyName})
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowNewSession((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#CBDCD4] bg-white px-3 py-1.5 text-xs font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start Period Session</span>
            </button>
            {activeSession && activeSession.status !== 'FINALIZED' && (
              <button
                type="button"
                onClick={() => void handleFinalizeSession()}
                className="inline-flex items-center gap-1 rounded-lg bg-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Finalize Session</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Department</label>
            <select
              disabled={!isAdmin}
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E] disabled:bg-slate-50 disabled:text-slate-600"
            >
              {data.departments.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code}
                </option>
              ))}
            </select>
          </div>
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
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Classroom</label>
            <select
              value={activeClassroom?.id ?? ''}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
            >
              {deptClassrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.roomCode} · {c.roomName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">Period Session</label>
            <select
              value={activeSession?.id ?? ''}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
            >
              {matchingSessions.length === 0 && <option value="">No Active Session</option>}
              {matchingSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.status}] {s.periodLabel} · {s.subjectName} ({s.sessionDate})
                </option>
              ))}
            </select>
          </div>
        </div>

        {showNewSession && (
          <form
            onSubmit={handleCreateSession}
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#D1E7DC] pt-3"
          >
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Select Subject (or leave to use Timetable Subject)
              </label>
              <select
                value={newSubjectId}
                onChange={(e) => setNewSubjectId(e.target.value)}
                className="w-full rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs text-[#0F1F1E]"
              >
                <option value="">
                  Auto-resolve from Timetable ({timetableContext.subjectName})
                </option>
                {data.subjects
                  .filter((sub) => sub.department === selectedDept)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.subjectCode} · {sub.subjectName} ({sub.academicYear})
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
            >
              Launch LIVE Session
            </button>
          </form>
        )}
      </section>

      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
          {actionMessage}
        </div>
      )}
      {cvError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{cvError}</span>
        </div>
      )}

      {/* Split Monitoring Stage */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Dual-Mode Video Stage + MediaPipe Detection */}
        <section className="space-y-4 rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${genuineCameraBadge.cls}`}>
                  {genuineCameraBadge.label}
                </span>
                <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#172B2A]">
                  {activeCamera ? `${activeCamera.cameraNumber} · ${activeCamera.name}` : 'Camera Stage'}
                </h3>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-slate-600">
                MediaPipe State: <strong className="text-[#059669]">{mediaPipeState}</strong> (
                {mediaPipeDelegate}) · Detected Faces: <strong>{detectedFacesCount}</strong>
              </p>
            </div>

            {/* Mode Switcher: Mode A (Live Webcam) vs Mode B (Demo Video) */}
            <div className="inline-flex rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  stopFeed();
                  setFeedMode('WEBCAM');
                }}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  feedMode === 'WEBCAM'
                    ? 'bg-[#172B2A] text-white'
                    : 'text-slate-600 hover:text-[#172B2A]'
                }`}
              >
                Mode A · Live Webcam
              </button>
              <button
                type="button"
                onClick={() => {
                  stopFeed();
                  setFeedMode('DEMO_VIDEO');
                }}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  feedMode === 'DEMO_VIDEO'
                    ? 'bg-amber-500 font-semibold text-white'
                    : 'text-slate-600 hover:text-[#172B2A]'
                }`}
              >
                Mode B · Demo Video
              </button>
            </div>
          </div>

          {feedMode === 'DEMO_VIDEO' && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                <strong>DEMO VIDEO MODE:</strong> Real MediaPipe BlazeFace detection runs on
                your uploaded video, while saving genuine attendance logs is strictly disabled.
              </span>
            </div>
          )}

          {/* Video + Synced Canvas Bounding-Box Overlay */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#172B2A]/20 bg-[#10201F]">
            <video
              ref={videoRef}
              muted
              playsInline
              loop={feedMode === 'DEMO_VIDEO'}
              className="h-full w-full object-contain"
            />
            <canvas
              ref={overlayCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
            {!feedActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-[#ECFDF5]">
                <VideoOff className="h-9 w-9 text-[#34D399]/75" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold">
                  {feedMode === 'DEMO_VIDEO'
                    ? 'Classroom Demo Video Idle — Upload MP4/WebM to run MediaPipe Face Detection'
                    : 'Camera Standby — Start Live Webcam to begin real-time face detection'}
                </p>
                <p className="mt-1 max-w-md text-[11px] text-[#ECFDF5]/65">
                  Powered locally by Google MediaPipe Face Detector (`blaze_face_short_range.tflite`).
                  Zero simulated faces or synthetic counts.
                </p>
              </div>
            )}
          </div>

          {/* Mode-Specific Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {feedMode === 'WEBCAM' ? (
              <div className="flex flex-wrap items-center gap-2">
                {videoDevices.length > 0 && (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    disabled={feedActive}
                    className="max-w-[200px] rounded-lg border border-[#CBDCD4] bg-white px-2.5 py-2 text-xs text-[#0F1F1E] disabled:opacity-60"
                  >
                    {videoDevices.map((dev, i) => (
                      <option key={dev.deviceId || i} value={dev.deviceId}>
                        {dev.label || `Camera Device ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                {!feedActive ? (
                  <button
                    type="button"
                    onClick={() => void handleStartLiveWebcam()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#06281E] hover:bg-[#059669] hover:text-white"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Start Camera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopFeed}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                  >
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Stop Camera</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#172B2A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10201F]">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{demoVideoUrl ? 'Change Demo Video' : 'Upload MP4 / WebM'}</span>
                  <input
                    ref={demoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/*"
                    onChange={(e) => void handleDemoVideoUpload(e)}
                    className="hidden"
                  />
                </label>

                {feedActive && (
                  <>
                    <button
                      type="button"
                      onClick={handleDemoPlayPause}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981]"
                    >
                      {demoPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      <span>{demoPaused ? 'Play' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDemoRestart}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#CBDCD4] bg-white px-3 py-2 text-xs font-medium text-[#172B2A] hover:border-[#10B981]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restart</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopFeed}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Stop</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Separate Biometric Recognition Toggle */}
            <button
              type="button"
              onClick={() => void handleToggleRecognition()}
              disabled={feedMode === 'DEMO_VIDEO'}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                recognitionActive
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'bg-[#172B2A] text-white hover:bg-[#10201F]'
              }`}
            >
              {recognitionActive ? (
                <>
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Stop Biometric Match</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Start Biometric Attendance</span>
                </>
              )}
            </button>
          </div>

          {/* Transparent Dual Pipeline Status Cards */}
          <div className="grid gap-3 rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-3 text-[11px] sm:grid-cols-4">
            <div>
              <span className="block text-slate-500">Face Detection (MediaPipe)</span>
              <span className="font-mono font-semibold text-[#059669]">{mediaPipeState}</span>
            </div>
            <div>
              <span className="block text-slate-500">Detected Faces</span>
              <span className="font-mono font-bold text-[#172B2A]">
                {detectedFacesCount} {demoVideoName && feedMode === 'DEMO_VIDEO' ? `(${demoVideoName.slice(0, 14)})` : ''}
              </span>
            </div>
            <div>
              <span className="flex items-center gap-1 text-slate-500">
                <Cpu className="h-3 w-3 text-[#059669]" aria-hidden="true" />
                <span>Recognition Engine</span>
              </span>
              <span className="block truncate font-medium text-[#172B2A]">{recognitionStatus}</span>
            </div>
            <div>
              <span className="block text-slate-500">Consented Templates</span>
              <span className="font-mono font-semibold text-[#172B2A]">
                {enrolledTemplates.length} Enrolled ({selectedDept})
              </span>
            </div>
          </div>

          {mediaPipeFaces.length > 0 && (
            <div className="rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-3 text-xs">
              <div className="font-semibold text-[#172B2A]">
                Real-Time MediaPipe Bounding Boxes ({mediaPipeFaces.length} face(s))
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {mediaPipeFaces.map((f, idx) => (
                  <span
                    key={idx}
                    className="rounded border border-[#D1E7DC] bg-white px-2.5 py-1 font-mono text-[11px] text-[#172B2A]"
                  >
                    Face #{idx + 1} · {Math.round(f.confidence * 100)}% conf ({Math.round(f.width)}×
                    {Math.round(f.height)}px)
                  </span>
                ))}
              </div>
            </div>
          )}

          {liveDetections.length > 0 && feedMode !== 'DEMO_VIDEO' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
              <div className="font-semibold text-emerald-900">
                Biometric Recognition Matches ({liveDetections.length})
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {liveDetections.map((det, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-emerald-200 bg-white px-2.5 py-1 font-mono text-[11px] text-[#172B2A]"
                  >
                    {det.matchedStudent ? det.matchedStudent.fullName : 'Unknown'} ·{' '}
                    {Math.round(det.confidence * 100)}% · {det.livenessStatus} ({det.outcome})
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Side: Live Session Counts & Roster */}
        <section className="space-y-4 rounded-xl border border-[#D1E7DC] bg-white p-5 shadow-xs lg:col-span-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-2.5">
              <span className="block text-[10px] text-slate-600">Total Cohort</span>
              <span className="font-mono text-lg font-bold tabular-nums text-[#172B2A]">
                {cohortStudents.length}
              </span>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <span className="block text-[10px] text-emerald-800">Present</span>
              <span className="font-mono text-lg font-bold tabular-nums text-emerald-900">
                {presentCount}
              </span>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
              <span className="block text-[10px] text-rose-800">Absent</span>
              <span className="font-mono text-lg font-bold tabular-nums text-rose-900">
                {absentCount}
              </span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <span className="block text-[10px] text-amber-800">Pending</span>
              <span className="font-mono text-lg font-bold tabular-nums text-amber-900">
                {pendingCount}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-[#D1E7DC] pb-3">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'PRESENT', label: 'Present' },
                { id: 'ABSENT', label: 'Absent' },
                { id: 'PENDING_VERIFICATION', label: 'Pending' },
                { id: 'UNKNOWN', label: `Unknown (${unknownEvents.length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRosterFilter(f.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  rosterFilter === f.id
                    ? 'bg-[#172B2A] font-semibold text-white'
                    : 'border border-[#CBDCD4] text-slate-600 hover:border-[#10B981]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="max-h-[460px] space-y-2.5 overflow-y-auto pr-1">
            {rosterFilter === 'UNKNOWN' ? (
              unknownEvents.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No unmatched faces recorded during this live session.
                </p>
              ) : (
                unknownEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-semibold text-amber-700">UNMATCHED FACE</span>
                      <span className="text-slate-500">
                        {new Date(evt.capturedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700">
                      Similarity {(evt.confidence * 100).toFixed(1)}% (below threshold) · Liveness:{' '}
                      {evt.livenessStatus}
                    </p>
                  </div>
                ))
              )
            ) : filteredRoster.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No students in this cohort view.
              </p>
            ) : (
              filteredRoster.map((stu) => {
                const rec = sessionAttendanceMap.get(stu.id);
                const statusLabel = rec
                  ? rec.status
                  : activeSession?.status === 'FINALIZED'
                    ? 'ABSENT'
                    : 'NOT YET MARKED';

                return (
                  <div
                    key={stu.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-[#D1E7DC] bg-[#F8FCF9] p-3 text-xs sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-2.5">
                      {stu.photoDataUrl ? (
                        <img
                          src={stu.photoDataUrl}
                          alt={stu.fullName}
                          className="h-9 w-9 rounded-lg border border-[#10B981]/50 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#CBDCD4] bg-white font-mono text-xs font-semibold text-[#172B2A]">
                          {stu.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-[#172B2A]">{stu.fullName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {stu.registerNo}
                          {rec?.confidence !== null && rec?.confidence !== undefined
                            ? ` · ${(rec.confidence * 100).toFixed(0)}% AI`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          statusLabel === 'PRESENT' ||
                          statusLabel === 'LATE' ||
                          statusLabel === 'MANUALLY_CORRECTED'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                            : statusLabel === 'ABSENT'
                              ? 'border border-rose-200 bg-rose-50 text-rose-800'
                              : 'border border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {statusLabel}
                      </span>

                      {activeSession && feedMode !== 'DEMO_VIDEO' && (
                        <>
                          {rec?.status === 'PENDING_VERIFICATION' ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleManualMark(
                                    stu.id,
                                    'PRESENT',
                                    'Approved from pending verification',
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded bg-[#10B981] px-2 py-1 text-[10px] font-semibold text-[#06281E]"
                              >
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleManualMark(
                                    stu.id,
                                    'ABSENT',
                                    'Rejected from pending verification',
                                  )
                                }
                                className="rounded border border-rose-200 px-2 py-1 text-[10px] text-rose-700"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            data.settings.allowManualFallback && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleManualMark(
                                    stu.id,
                                    rec?.status === 'PRESENT' ? 'ABSENT' : 'PRESENT',
                                    'Manual verification fallback toggle',
                                  )
                                }
                                className="rounded border border-[#CBDCD4] bg-white px-2 py-1 text-[10px] font-medium text-[#172B2A] hover:border-[#10B981] hover:text-[#059669]"
                              >
                                {rec?.status === 'PRESENT' ? 'Mark Absent' : 'Mark Present'}
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
