import * as faceapi from '@vladmandic/face-api';
import type {
  FaceEnrollmentRecord,
  LivenessStatus,
  RecognitionOutcome,
  StudentRecord,
} from '../types/smartattend';

export interface EnrolledTemplateItem {
  student: StudentRecord;
  enrollment: FaceEnrollmentRecord;
  descriptorFloat32: Float32Array;
}

export interface DetectedFaceResult {
  box: { x: number; y: number; width: number; height: number };
  matchedStudent: StudentRecord | null;
  confidence: number;
  distance: number;
  livenessStatus: LivenessStatus;
  outcome: RecognitionOutcome;
}

export interface LivenessTrackerState {
  staticStreakByKey: Map<string, { lastCx: number; lastCy: number; lastEar: number; staticFrames: number }>;
}

export function createLivenessTrackerState(): LivenessTrackerState {
  return {
    staticStreakByKey: new Map(),
  };
}

let modelsLoaded = false;
let modelsLoadingPromise: Promise<void> | null = null;

export function isCvEngineReady(): boolean {
  return modelsLoaded;
}

export async function ensureCvModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  if (!modelsLoadingPromise) {
    modelsLoadingPromise = (async () => {
      const modelBaseUrl = '/cv-models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelBaseUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl),
      ]);
      modelsLoaded = true;
    })().catch((err) => {
      modelsLoadingPromise = null;
      throw new Error(
        `Failed to load local neural face models from /cv-models: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }
  return modelsLoadingPromise;
}

function computeEyeAspectRatio(pts: Array<{ x: number; y: number }>): number {
  if (pts.length < 48) return 0.3;
  // Left eye indices 36..41
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const v1 = dist(pts[37], pts[41]);
  const v2 = dist(pts[38], pts[40]);
  const h = dist(pts[36], pts[39]) || 1;
  return (v1 + v2) / (2 * h);
}

function createCroppedPortraitDataUrl(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height;

  const padX = box.width * 0.25;
  const padY = box.height * 0.25;
  const sx = Math.max(0, box.x - padX);
  const sy = Math.max(0, box.y - padY);
  const sw = Math.min(srcW - sx, box.width + padX * 2);
  const sh = Math.min(srcH - sy, box.height + padY * 2);

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 180, 180);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function extractSingleFaceDescriptor(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<{
  descriptor: number[];
  portraitDataUrl: string;
  detectionScore: number;
}> {
  await ensureCvModelsLoaded();

  const detections = await faceapi
    .detectAllFaces(
      source,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) {
    throw new Error(
      'No human face detected in frame. Ensure clear frontal lighting and try again.',
    );
  }
  if (detections.length > 1) {
    throw new Error(
      `Detected ${detections.length} faces in enrollment frame. Only 1 student should be visible during enrollment.`,
    );
  }

  const det = detections[0];
  const portraitDataUrl = createCroppedPortraitDataUrl(source, det.detection.box);

  return {
    descriptor: Array.from(det.descriptor, (v) => Number(v.toFixed(6))),
    portraitDataUrl,
    detectionScore: Number(det.detection.score.toFixed(3)),
  };
}

export async function analyzeVideoFrame(
  video: HTMLVideoElement,
  templates: EnrolledTemplateItem[],
  thresholds: { highConfidence: number; pendingConfidence: number },
  tracker: LivenessTrackerState,
): Promise<DetectedFaceResult[]> {
  await ensureCvModelsLoaded();
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return [];
  }

  const detections = await faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  const results: DetectedFaceResult[] = [];

  for (const det of detections) {
    const box = det.detection.box;
    let bestStudent: StudentRecord | null = null;
    let bestDistance = 1.0;

    for (const tpl of templates) {
      const dist = faceapi.euclideanDistance(det.descriptor, tpl.descriptorFloat32);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestStudent = tpl.student;
      }
    }

    const confidence = Math.max(0, Math.min(1, Number((1 - bestDistance).toFixed(3))));
    const trackKey = bestStudent ? bestStudent.id : `anon-${Math.round(box.x / 40)}`;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const ear = computeEyeAspectRatio(det.landmarks.positions);

    const prev = tracker.staticStreakByKey.get(trackKey);
    let livenessStatus: LivenessStatus = 'VERIFIED';

    if (prev) {
      const motionDelta = Math.hypot(cx - prev.lastCx, cy - prev.lastCy);
      const earDelta = Math.abs(ear - prev.lastEar);
      if (motionDelta < 0.35 && earDelta < 0.008) {
        const nextStreak = prev.staticFrames + 1;
        tracker.staticStreakByKey.set(trackKey, {
          lastCx: cx,
          lastCy: cy,
          lastEar: ear,
          staticFrames: nextStreak,
        });
        if (nextStreak >= 6) {
          livenessStatus = 'STATIC_WARNING';
        }
      } else {
        tracker.staticStreakByKey.set(trackKey, {
          lastCx: cx,
          lastCy: cy,
          lastEar: ear,
          staticFrames: 0,
        });
        livenessStatus = 'VERIFIED';
      }
    } else {
      tracker.staticStreakByKey.set(trackKey, {
        lastCx: cx,
        lastCy: cy,
        lastEar: ear,
        staticFrames: 0,
      });
      livenessStatus = 'UNCHECKED';
    }

    let outcome: RecognitionOutcome = 'UNKNOWN';
    if (bestStudent && confidence >= thresholds.pendingConfidence) {
      if (livenessStatus === 'STATIC_WARNING') {
        outcome = 'LIVENESS_WARNING';
      } else if (confidence >= thresholds.highConfidence) {
        outcome = 'MATCHED_PRESENT';
      } else {
        outcome = 'PENDING_VERIFICATION';
      }
    } else {
      bestStudent = null;
      outcome = 'UNKNOWN';
    }

    results.push({
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      matchedStudent: bestStudent,
      confidence,
      distance: Number(bestDistance.toFixed(3)),
      livenessStatus,
      outcome,
    });
  }

  return results;
}
