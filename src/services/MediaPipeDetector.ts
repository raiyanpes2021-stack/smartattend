import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export type MediaPipeDetectorState =
  | 'NOT_LOADED'
  | 'MODEL LOADING'
  | 'MODEL READY'
  | 'DETECTING FACES'
  | 'NO FACES DETECTED'
  | 'DETECTION ERROR';

export interface MediaPipeDetectedFace {
  originX: number;
  originY: number;
  width: number;
  height: number;
  confidence: number;
  keypoints: Array<{ x: number; y: number }>;
}

export interface MediaPipeDetectionOutput {
  state: MediaPipeDetectorState;
  faces: MediaPipeDetectedFace[];
  delegate: 'GPU' | 'CPU';
  errorMessage?: string;
}

let detectorInstance: FaceDetector | null = null;
let detectorInitPromise: Promise<FaceDetector> | null = null;
let currentState: MediaPipeDetectorState = 'NOT_LOADED';
let activeDelegate: 'GPU' | 'CPU' = 'GPU';
let lastInitError: string | null = null;

export function getMediaPipeDetectorStatus(): {
  state: MediaPipeDetectorState;
  delegate: 'GPU' | 'CPU';
  error: string | null;
} {
  return {
    state: currentState,
    delegate: activeDelegate,
    error: lastInitError,
  };
}

export async function ensureMediaPipeFaceDetector(): Promise<FaceDetector> {
  if (detectorInstance) return detectorInstance;
  if (detectorInitPromise) return detectorInitPromise;

  currentState = 'MODEL LOADING';
  lastInitError = null;

  detectorInitPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
      try {
        detectorInstance = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe-models/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55,
          minSuppressionThreshold: 0.3,
        });
        activeDelegate = 'GPU';
      } catch {
        detectorInstance = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe-models/blaze_face_short_range.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55,
          minSuppressionThreshold: 0.3,
        });
        activeDelegate = 'CPU';
      }
      currentState = 'MODEL READY';
      return detectorInstance;
    } catch (err) {
      currentState = 'DETECTION ERROR';
      lastInitError =
        err instanceof Error ? err.message : 'Failed to initialize MediaPipe FaceDetector.';
      detectorInitPromise = null;
      throw err;
    }
  })();

  return detectorInitPromise;
}

export function detectFacesWithMediaPipe(
  video: HTMLVideoElement,
  timestampMs: number,
): MediaPipeDetectionOutput {
  if (!detectorInstance) {
    return {
      state: currentState === 'DETECTION ERROR' ? 'DETECTION ERROR' : 'MODEL LOADING',
      faces: [],
      delegate: activeDelegate,
      errorMessage: lastInitError ?? undefined,
    };
  }

  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return {
      state: 'MODEL READY',
      faces: [],
      delegate: activeDelegate,
    };
  }

  try {
    const result = detectorInstance.detectForVideo(video, Math.max(0, Math.round(timestampMs)));
    const detections = result.detections ?? [];
    const faces: MediaPipeDetectedFace[] = detections
      .filter((d) => Boolean(d.boundingBox))
      .map((d) => ({
        originX: d.boundingBox!.originX,
        originY: d.boundingBox!.originY,
        width: d.boundingBox!.width,
        height: d.boundingBox!.height,
        confidence: d.categories?.[0]?.score ?? 0,
        keypoints: (d.keypoints ?? []).map((kp) => ({
          x: kp.x * video.videoWidth,
          y: kp.y * video.videoHeight,
        })),
      }));

    const state: MediaPipeDetectorState =
      faces.length > 0 ? 'DETECTING FACES' : 'NO FACES DETECTED';
    currentState = state;
    lastInitError = null;
    return {
      state,
      faces,
      delegate: activeDelegate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MediaPipe detection frame error.';
    currentState = 'DETECTION ERROR';
    lastInitError = message;
    return {
      state: 'DETECTION ERROR',
      faces: [],
      delegate: activeDelegate,
      errorMessage: message,
    };
  }
}
