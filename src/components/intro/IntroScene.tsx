import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ArrowRight, EyeOff, RotateCcw } from 'lucide-react';
import { createCollegeCorridor } from '../../three/CollegeCorridor';
import { createStudentCharacter } from '../../three/StudentCharacter';
import { createCinematicDirector } from '../../three/CinematicCamera';
import { createCorridorTextures } from '../../three/proceduralTextures';

const FALLBACK_CORRIDOR_IMG = '/src/assets/images/corridor_ivory_teal_gold_1795024559544.jpg';
const TOTAL_INTRO_DURATION = 15.7;

interface IntroSceneProps {
  reducedMotion: boolean;
  rememberSkip: boolean;
  onToggleReducedMotion: () => void;
  onToggleRememberSkip: (remember: boolean) => void;
  onComplete: () => void;
}

function getSceneCaption(elapsed: number): { index: string; label: string } {
  if (elapsed < 6.4) {
    return { index: '01', label: 'Engineering Corridor' };
  }
  if (elapsed < 10.2) {
    return { index: '02', label: 'Classroom Entrance' };
  }
  if (elapsed < 13.0) {
    return { index: '03', label: 'Entering Lecture Hall' };
  }
  return { index: '04', label: 'Focusing on Teaching Board' };
}

export function IntroScene({
  reducedMotion,
  rememberSkip,
  onToggleReducedMotion,
  onToggleRememberSkip,
  onComplete,
}: IntroSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState(() => getSceneCaption(0));
  const [boardRevealOpacity, setBoardRevealOpacity] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  };

  useEffect(() => {
    if (!reducedMotion && !webglUnavailable) return;

    const timer = window.setTimeout(() => {
      setBoardRevealOpacity(1);
      window.setTimeout(finishIntro, 420);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [reducedMotion, webglUnavailable]);

  useEffect(() => {
    if (reducedMotion || webglUnavailable) return;
    const container = mountRef.current;
    if (!container) return;

    completedRef.current = false;
    setBoardRevealOpacity(0);
    setProgress(0);

    let isSoftwareGl = false;
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) {
        setWebglUnavailable(true);
        return;
      }
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpuName = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);
    } catch {
      setWebglUnavailable(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    // Scene & subtle natural atmospheric depth
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x172b35);
    scene.fog = new THREE.FogExp2(0x172b35, 0.016);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Natural Warm Daylight + Cool Sky Fill Rig
    const hemiLight = new THREE.HemisphereLight(0xf5f0e6, 0x172b35, 0.72);
    scene.add(hemiLight);

    const corridorKeyLight = new THREE.DirectionalLight(0xf5f0e6, 1.4);
    corridorKeyLight.position.set(-2.2, 4.4, -2.5);
    corridorKeyLight.castShadow = !isSoftwareGl;
    corridorKeyLight.shadow.mapSize.set(1024, 1024);
    corridorKeyLight.shadow.camera.near = 0.5;
    corridorKeyLight.shadow.camera.far = 26;
    corridorKeyLight.shadow.camera.left = -5;
    corridorKeyLight.shadow.camera.right = 5;
    corridorKeyLight.shadow.camera.top = 10;
    corridorKeyLight.shadow.camera.bottom = -16;
    corridorKeyLight.shadow.bias = -0.0005;
    corridorKeyLight.shadow.normalBias = 0.02;
    scene.add(corridorKeyLight);

    const fillLight = new THREE.DirectionalLight(0xd5ad70, 0.25);
    fillLight.position.set(2.0, 2.5, 4.0);
    scene.add(fillLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createCorridorTextures(maxAnisotropy);
    const corridor = createCollegeCorridor(textures, isSoftwareGl);
    scene.add(corridor.group);

    const student = createStudentCharacter(textures);
    scene.add(student.group);

    const director = createCinematicDirector(width / height);

    // Subtle Cinematic Depth of Field on GPU devices (skipped on software WebGL)
    let composer: EffectComposer | null = null;
    let bokehPass: BokehPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, director.camera));
      bokehPass = new BokehPass(scene, director.camera, {
        focus: 3.2,
        aperture: 0.00016,
        maxblur: 0.0045,
      });
      composer.addPass(bokehPass);
      composer.addPass(new OutputPass());
      renderer.compile(scene, director.camera);
    }

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      director.setAspect(w / h);
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let frameId = 0;
    let disposed = false;
    let lastTimestamp = performance.now();
    let elapsed = 0;
    let walkPhase = 0;
    let uiSyncAccum = 0;
    let lastCaptionIndex = '01';

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = (now?: number) => {
      if (disposed) return;

      const currentNow = typeof now === 'number' ? now : performance.now();
      const rawDelta = (currentNow - lastTimestamp) / 1000;
      lastTimestamp = currentNow;
      const delta = Math.min(Math.max(rawDelta, 0.001), 0.08);
      elapsed += delta;

      // Advance GSAP director timeline deterministically
      director.timeline.time(Math.min(elapsed, TOTAL_INTRO_DURATION));
      const st = director.state;

      // Advance natural walking cycle proportional to movement speed
      walkPhase += delta * 6.5 * st.walkSpeedScale;

      student.setPosition(st.studentX, 0, st.studentZ);
      student.setFacingAngle(st.studentYaw);
      student.updateAnimation({
        walkPhase,
        walkWeight: st.walkWeight,
        reachWeight: st.reachWeight,
        idleTime: elapsed,
      });

      corridor.door.setAccessGranted(elapsed >= 7.6);
      corridor.door.setOpenProgress(st.doorOpenProgress, st.handleDepress);
      corridor.classroomLightIntensity(st.doorOpenProgress);

      director.applyCamera();

      const bokehUniforms = bokehPass?.uniforms as Record<string, THREE.IUniform> | undefined;
      if (bokehUniforms?.focus) {
        bokehUniforms.focus.value = st.dofFocus;
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, director.camera);
      }

      uiSyncAccum += delta;
      if (uiSyncAccum >= 0.08) {
        uiSyncAccum = 0;
        setProgress(Math.min(1, elapsed / TOTAL_INTRO_DURATION));
        const nextCap = getSceneCaption(elapsed);
        if (nextCap.index !== lastCaptionIndex) {
          lastCaptionIndex = nextCap.index;
          setCaption(nextCap);
        }
        setBoardRevealOpacity(st.boardRevealOpacity);
      }

      if (elapsed >= TOTAL_INTRO_DURATION) {
        finishIntro();
        return;
      }

      if (isSoftwareGl) {
        afterDraw(() => tick());
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(() => tick());
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      director.dispose();
      corridor.dispose();
      student.dispose();
      textures.dispose();
      envTarget.dispose();
      composer?.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [reducedMotion, webglUnavailable, replayNonce]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#172B35] text-[#F5F0E6]">
      {!reducedMotion && !webglUnavailable ? (
        <div
          ref={mountRef}
          className="absolute inset-0 h-full w-full"
          aria-label="Cinematic 3D sequence entering the SMARTATTEND classroom"
        />
      ) : (
        <div className="absolute inset-0 h-full w-full">
          <img
            src={FALLBACK_CORRIDOR_IMG}
            alt="Quiet engineering college corridor opening into sunlit lecture classroom"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#172B35]/85 via-[#172B35]/25 to-[#172B35]/45" />
        </div>
      )}

      {/* Subtle Filmic Vignette & Seamless Cross-Fade into Teaching Board */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, transparent 52%, rgba(23, 43, 53, 0.55) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[#172B35] transition-opacity duration-300"
        style={{ opacity: boardRevealOpacity }}
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-6 px-6 py-5 sm:px-10">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[#F5F0E6]">
          SMARTATTEND
        </span>

        <div className="flex items-center gap-3 text-xs font-medium text-[#F5F0E6]/85">
          <span className="font-mono tabular-nums text-[#D5AD70]">{caption.index}</span>
          <span aria-hidden="true" className="text-[#F5F0E6]/35">
            /
          </span>
          <span className="whitespace-nowrap">{caption.label}</span>
        </div>
      </header>

      {/* Fallback Copy when Reduced Motion or WebGL Unavailable */}
      {(reducedMotion || webglUnavailable) && (
        <div className="relative z-10 flex h-[calc(100vh-160px)] flex-col items-center justify-center px-6 text-center">
          <h1 className="max-w-xl text-balance font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#F5F0E6] sm:text-4xl">
            SMARTATTEND
          </h1>
          <p className="mt-3 text-sm text-[#D5AD70]">
            Smart Attendance. Zero Smartphones.
          </p>
        </div>
      )}

      {/* Minimal Bottom Control Bar */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[min(740px,92vw)] -translate-x-1/2 rounded-xl border border-[#F5F0E6]/15 bg-[#172B35]/92 px-4 py-3 shadow-2xl sm:px-6">
        <div className="mb-3 h-[2px] w-full overflow-hidden rounded-full bg-[#F5F0E6]/15">
          <div
            className="h-full bg-[#D5AD70] transition-[width] duration-150 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#F5F0E6]/85 hover:text-[#F5F0E6]">
              <input
                type="checkbox"
                checked={rememberSkip}
                onChange={(e) => onToggleRememberSkip(e.target.checked)}
                className="h-4 w-4 rounded border-[#F5F0E6]/30 bg-[#172B35] accent-[#D5AD70]"
              />
              <span className="whitespace-nowrap">Skip intro on next visit</span>
            </label>

            <button
              type="button"
              onClick={onToggleReducedMotion}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#F5F0E6]/18 px-3 py-1.5 text-xs font-medium text-[#F5F0E6]/85 transition-colors hover:border-[#D5AD70]/70 hover:text-[#F5F0E6]"
            >
              <EyeOff className="h-3.5 w-3.5 text-[#D5AD70]" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {reducedMotion ? 'Enable 3D Motion' : 'Reduced Motion'}
              </span>
            </button>

            {!reducedMotion && !webglUnavailable && (
              <button
                type="button"
                onClick={() => setReplayNonce((n) => n + 1)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#F5F0E6]/18 px-3 py-1.5 text-xs font-medium text-[#F5F0E6]/85 transition-colors hover:border-[#D5AD70]/70 hover:text-[#F5F0E6]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#D5AD70]" aria-hidden="true" />
                <span className="whitespace-nowrap">Restart</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={finishIntro}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#D5AD70] px-4 py-2 text-xs font-semibold text-[#172B35] transition-colors hover:bg-[#D5AD70]/90"
          >
            <span>Skip Intro</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
