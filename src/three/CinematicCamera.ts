import * as THREE from 'three';
import gsap from 'gsap';

export interface CinematicSequenceState {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
  dofFocus: number;
  studentX: number;
  studentZ: number;
  studentYaw: number;
  walkWeight: number;
  walkSpeedScale: number;
  reachWeight: number;
  handleDepress: number;
  doorOpenProgress: number;
  boardRevealOpacity: number;
}

export interface CinematicDirectorRig {
  camera: THREE.PerspectiveCamera;
  state: CinematicSequenceState;
  timeline: gsap.core.Timeline;
  setAspect: (aspect: number) => void;
  applyCamera: () => void;
  dispose: () => void;
}

export function createCinematicDirector(aspect: number): CinematicDirectorRig {
  const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 80);

  // Initial state: Quiet engineering corridor establishing shot behind student
  const state: CinematicSequenceState = {
    camX: -0.44,
    camY: 1.56,
    camZ: 3.4,
    lookX: 0.05,
    lookY: 1.38,
    lookZ: -4.5,
    fov: 42,
    dofFocus: 3.2,
    studentX: 0.14,
    studentZ: 0.6,
    studentYaw: 0,
    walkWeight: 0,
    walkSpeedScale: 0,
    reachWeight: 0,
    handleDepress: 0,
    doorOpenProgress: 0,
    boardRevealOpacity: 0,
  };

  camera.position.set(state.camX, state.camY, state.camZ);
  camera.lookAt(state.lookX, state.lookY, state.lookZ);

  // 15.6-second slow, realistic cinematic GSAP timeline
  const timeline = gsap.timeline({ paused: true });

  // 0.0s -> 1.2s: Quiet corridor establishing beat; student begins calm walk
  timeline.to(
    state,
    {
      walkWeight: 1,
      walkSpeedScale: 1,
      duration: 0.9,
      ease: 'sine.inOut',
    },
    0.4,
  );

  // 0.6s -> 6.8s: Student walks calmly down the engineering corridor toward Classroom 204
  timeline.to(
    state,
    {
      studentZ: -11.18,
      duration: 6.2,
      ease: 'power1.inOut',
    },
    0.6,
  );

  // Camera smoothly tracks behind student down the corridor
  timeline.to(
    state,
    {
      camX: -0.48,
      camY: 1.5,
      camZ: -8.65,
      lookX: 0.12,
      lookY: 1.36,
      lookZ: -13.2,
      dofFocus: 2.8,
      duration: 6.4,
      ease: 'power1.inOut',
    },
    0.4,
  );

  // 6.3s -> 7.0s: Student naturally decelerates and pauses in front of door
  timeline.to(
    state,
    {
      walkWeight: 0,
      walkSpeedScale: 0,
      duration: 0.7,
      ease: 'power2.out',
    },
    6.3,
  );

  // 7.1s -> 7.9s: Right hand reaches naturally toward Champagne Gold door lever
  timeline.to(
    state,
    {
      reachWeight: 1,
      duration: 0.8,
      ease: 'power2.inOut',
    },
    7.1,
  );

  // 7.9s -> 8.5s: Lever depresses smoothly
  timeline.to(
    state,
    {
      handleDepress: 1,
      duration: 0.35,
      ease: 'power2.inOut',
    },
    7.9,
  );
  timeline.to(
    state,
    {
      handleDepress: 0,
      duration: 0.45,
      ease: 'power2.out',
    },
    8.35,
  );

  // 8.2s -> 10.6s: Heavy classroom door physically rotates on its 3D vertical hinge
  timeline.to(
    state,
    {
      doorOpenProgress: 1,
      duration: 2.4,
      ease: 'power2.inOut',
    },
    8.2,
  );

  // 8.7s -> 9.6s: Student lowers hand naturally as door opens
  timeline.to(
    state,
    {
      reachWeight: 0,
      duration: 0.85,
      ease: 'power2.inOut',
    },
    8.7,
  );

  // 9.4s -> 13.0s: Student steps inside classroom and walks calmly toward his left-row seat
  timeline.to(
    state,
    {
      walkWeight: 0.9,
      walkSpeedScale: 0.85,
      duration: 0.5,
      ease: 'sine.in',
    },
    9.4,
  );
  timeline.to(
    state,
    {
      studentX: -1.15,
      studentZ: -15.3,
      studentYaw: 0.35,
      duration: 3.3,
      ease: 'power1.inOut',
    },
    9.5,
  );
  timeline.to(
    state,
    {
      walkWeight: 0,
      walkSpeedScale: 0,
      studentYaw: 1.15,
      duration: 0.7,
      ease: 'power2.out',
    },
    12.5,
  );

  // 9.4s -> 12.6s: Camera glides calmly through the open doorway into the sunlit classroom
  timeline.to(
    state,
    {
      camX: 0.18,
      camY: 1.54,
      camZ: -14.2,
      lookX: -0.1,
      lookY: 1.55,
      lookZ: -20.5,
      fov: 43,
      dofFocus: 5.5,
      duration: 3.2,
      ease: 'power1.inOut',
    },
    9.4,
  );

  // 12.6s -> 15.6s: Camera slowly pans front-center and zooms physically onto the teaching board until it fills the frame
  timeline.to(
    state,
    {
      camX: 0.0,
      camY: 1.72,
      camZ: -18.72,
      lookX: 0.0,
      lookY: 1.72,
      lookZ: -22.315,
      fov: 38,
      dofFocus: 3.6,
      duration: 3.0,
      ease: 'power2.inOut',
    },
    12.6,
  );

  // 14.9s -> 15.7s: Seamless cross-fade onto interactive Teaching Board DOM surface
  timeline.to(
    state,
    {
      boardRevealOpacity: 1,
      duration: 0.8,
      ease: 'power1.inOut',
    },
    14.9,
  );

  return {
    camera,
    state,
    timeline,
    setAspect: (nextAspect: number) => {
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
    },
    applyCamera: () => {
      camera.position.set(state.camX, state.camY, state.camZ);
      if (Math.abs(camera.fov - state.fov) > 0.01) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
      }
      camera.lookAt(state.lookX, state.lookY, state.lookZ);
    },
    dispose: () => {
      timeline.kill();
    },
  };
}
