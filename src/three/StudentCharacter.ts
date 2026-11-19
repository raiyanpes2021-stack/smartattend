import * as THREE from 'three';
import type { CorridorTextureBundle } from './proceduralTextures';

export interface StudentCharacterRig {
  group: THREE.Group;
  setPosition: (x: number, y: number, z: number) => void;
  setFacingAngle: (yawRad: number) => void;
  updateAnimation: (params: {
    walkPhase: number;
    walkWeight: number;
    reachWeight: number;
    idleTime: number;
  }) => void;
  dispose: () => void;
}

function createLatheLimbGeometry(
  profile: Array<[number, number]>,
  segments = 18,
): THREE.LatheGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments);
}

export function createStudentCharacter(textures: CorridorTextureBundle): StudentCharacterRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Clothing harmonized cleanly with Deep Teal (#172B35), Warm Ivory (#F5F0E6), Champagne Gold (#D5AD70)
  const jacketMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.fabricColor,
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.03,
    }),
  );

  const shirtCollarMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5f0e6,
      roughness: 0.74,
      metalness: 0.01,
    }),
  );

  const chinoMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e2c33,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const skinMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd19f7e,
      roughness: 0.58,
      metalness: 0.02,
    }),
  );

  const hairMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x16191e,
      roughness: 0.75,
      metalness: 0.04,
    }),
  );

  const sneakerUpperMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x172b35,
      roughness: 0.68,
      metalness: 0.04,
    }),
  );

  const sneakerSoleMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5f0e6,
      roughness: 0.58,
      metalness: 0.02,
    }),
  );

  const backpackBodyMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x12222a,
      roughness: 0.68,
      metalness: 0.05,
    }),
  );

  const goldTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd5ad70,
      roughness: 0.35,
      metalness: 0.65,
    }),
  );

  const contactShadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.72, 0.72)),
    track(
      new THREE.MeshBasicMaterial({
        map: textures.contactShadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.58,
      }),
    ),
  );
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.y = 0.004;
  group.add(contactShadow);

  const pelvisPivot = new THREE.Group();
  pelvisPivot.position.set(0, 0.92, 0);
  group.add(pelvisPivot);

  const pelvisMesh = new THREE.Mesh(
    track(
      createLatheLimbGeometry(
        [
          [0.125, -0.06],
          [0.145, 0.0],
          [0.138, 0.09],
          [0.01, 0.11],
        ],
        20,
      ),
    ),
    chinoMat,
  );
  pelvisMesh.scale.set(1.12, 1, 0.78);
  pelvisMesh.castShadow = true;
  pelvisPivot.add(pelvisMesh);

  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.09, 0);
  pelvisPivot.add(spinePivot);

  const torsoMesh = new THREE.Mesh(
    track(
      createLatheLimbGeometry(
        [
          [0.132, 0.0],
          [0.145, 0.14],
          [0.172, 0.34],
          [0.165, 0.43],
          [0.068, 0.47],
        ],
        22,
      ),
    ),
    jacketMat,
  );
  torsoMesh.scale.set(1.16, 1, 0.76);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  spinePivot.add(torsoMesh);

  const collarMesh = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.066, 0.074, 0.055, 18)),
    shirtCollarMat,
  );
  collarMesh.position.set(0, 0.47, 0.005);
  spinePivot.add(collarMesh);

  // Backpack
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.24, 0.145);
  spinePivot.add(backpackGroup);

  const packShape = new THREE.Shape();
  packShape.moveTo(-0.13, -0.18);
  packShape.lineTo(0.13, -0.18);
  packShape.quadraticCurveTo(0.15, -0.18, 0.15, -0.15);
  packShape.lineTo(0.14, 0.14);
  packShape.quadraticCurveTo(0.13, 0.19, 0.08, 0.19);
  packShape.lineTo(-0.08, 0.19);
  packShape.quadraticCurveTo(-0.13, 0.19, -0.14, 0.14);
  packShape.lineTo(-0.15, -0.15);
  packShape.quadraticCurveTo(-0.15, -0.18, -0.13, -0.18);

  const mainPackMesh = new THREE.Mesh(
    track(
      new THREE.ExtrudeGeometry(packShape, {
        depth: 0.11,
        bevelEnabled: true,
        bevelThickness: 0.024,
        bevelSize: 0.02,
        bevelSegments: 3,
      }),
    ),
    backpackBodyMat,
  );
  mainPackMesh.position.set(0, 0, -0.02);
  mainPackMesh.castShadow = true;
  mainPackMesh.receiveShadow = true;
  backpackGroup.add(mainPackMesh);

  const frontPocket = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.22, 0.2, 0.045)),
    jacketMat,
  );
  frontPocket.position.set(0, -0.05, 0.115);
  frontPocket.castShadow = true;
  backpackGroup.add(frontPocket);

  // Subtle Champagne Gold zipper clasp trim on backpack
  const goldZipperAccent = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.15, 0.01, 0.01)),
    goldTrimMat,
  );
  goldZipperAccent.position.set(0, 0.035, 0.139);
  backpackGroup.add(goldZipperAccent);

  const grabLoop = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI)),
    backpackBodyMat,
  );
  grabLoop.position.set(0, 0.21, 0.03);
  backpackGroup.add(grabLoop);

  [-0.1, 0.1].forEach((sx) => {
    const strap = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.042, 0.34, 0.025)),
      backpackBodyMat,
    );
    strap.position.set(sx, 0.04, -0.055);
    strap.rotation.x = 0.22;
    backpackGroup.add(strap);
  });

  // Neck & Sculpted Head
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.48, 0);
  spinePivot.add(neckPivot);

  const neckMesh = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.048, 0.055, 0.09, 16)),
    skinMat,
  );
  neckMesh.position.set(0, 0.04, 0);
  neckMesh.castShadow = true;
  neckPivot.add(neckMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.095, 0);
  neckPivot.add(headPivot);

  const headMesh = new THREE.Mesh(
    track(
      createLatheLimbGeometry(
        [
          [0.01, -0.01],
          [0.058, 0.02],
          [0.082, 0.075],
          [0.088, 0.135],
          [0.074, 0.19],
          [0.038, 0.218],
          [0.0, 0.225],
        ],
        22,
      ),
    ),
    skinMat,
  );
  headMesh.scale.set(0.92, 1.0, 1.06);
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  [-0.08, 0.08].forEach((ex) => {
    const ear = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.019, 10, 10)),
      skinMat,
    );
    ear.scale.set(0.45, 1.25, 0.78);
    ear.position.set(ex, 0.11, 0.01);
    headPivot.add(ear);
  });

  const hairBackCap = new THREE.Mesh(
    track(
      createLatheLimbGeometry(
        [
          [0.068, 0.055],
          [0.088, 0.095],
          [0.094, 0.15],
          [0.082, 0.2],
          [0.045, 0.228],
          [0.0, 0.234],
        ],
        22,
      ),
    ),
    hairMat,
  );
  hairBackCap.scale.set(0.96, 1.02, 1.1);
  hairBackCap.position.set(0, 0.004, 0.008);
  hairBackCap.castShadow = true;
  headPivot.add(hairBackCap);

  const hairCrown = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.086, 18, 14)),
    hairMat,
  );
  hairCrown.scale.set(0.95, 0.65, 1.08);
  hairCrown.position.set(0, 0.175, -0.01);
  headPivot.add(hairCrown);

  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.205, 0.41, 0);
    spinePivot.add(shoulder);

    const upperArmMesh = new THREE.Mesh(
      track(
        createLatheLimbGeometry(
          [
            [0.044, -0.27],
            [0.05, -0.14],
            [0.055, -0.02],
            [0.048, 0.02],
          ],
          14,
        ),
      ),
      jacketMat,
    );
    upperArmMesh.castShadow = true;
    shoulder.add(upperArmMesh);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.275, 0);
    shoulder.add(elbow);

    const forearmMesh = new THREE.Mesh(
      track(
        createLatheLimbGeometry(
          [
            [0.036, -0.23],
            [0.042, -0.12],
            [0.044, 0.0],
          ],
          14,
        ),
      ),
      jacketMat,
    );
    forearmMesh.castShadow = true;
    elbow.add(forearmMesh);

    const cuff = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.036, 0.037, 0.022, 12)),
      shirtCollarMat,
    );
    cuff.position.set(0, -0.232, 0);
    elbow.add(cuff);

    const hand = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.036, 12, 10)),
      skinMat,
    );
    hand.scale.set(0.68, 1.32, 0.92);
    hand.position.set(0, -0.275, -0.006);
    hand.castShadow = true;
    elbow.add(hand);

    return { shoulder, elbow, hand };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, -0.02, 0);
    pelvisPivot.add(hip);

    const thighMesh = new THREE.Mesh(
      track(
        createLatheLimbGeometry(
          [
            [0.06, -0.43],
            [0.072, -0.22],
            [0.082, -0.02],
            [0.068, 0.03],
          ],
          16,
        ),
      ),
      chinoMat,
    );
    thighMesh.castShadow = true;
    hip.add(thighMesh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.435, 0);
    hip.add(knee);

    const shinMesh = new THREE.Mesh(
      track(
        createLatheLimbGeometry(
          [
            [0.044, -0.39],
            [0.052, -0.22],
            [0.06, -0.08],
            [0.056, 0.0],
          ],
          16,
        ),
      ),
      chinoMat,
    );
    shinMesh.castShadow = true;
    knee.add(shinMesh);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.405, 0);
    knee.add(ankle);

    const sole = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.095, 0.028, 0.245)),
      sneakerSoleMat,
    );
    sole.position.set(0, -0.045, -0.042);
    sole.castShadow = true;
    ankle.add(sole);

    const upper = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.088, 0.055, 0.225)),
      sneakerUpperMat,
    );
    upper.position.set(0, -0.012, -0.035);
    upper.castShadow = true;
    ankle.add(upper);

    return { hip, knee, ankle };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  return {
    group,
    setPosition: (x: number, y: number, z: number) => {
      group.position.set(x, y, z);
    },
    setFacingAngle: (yawRad: number) => {
      group.rotation.y = yawRad;
    },
    updateAnimation: ({ walkPhase, walkWeight, reachWeight, idleTime }) => {
      const w = THREE.MathUtils.clamp(walkWeight, 0, 1);
      const r = THREE.MathUtils.clamp(reachWeight, 0, 1);

      const strideSin = Math.sin(walkPhase);
      const strideCos = Math.cos(walkPhase);

      // Calm, natural human cadence (no exaggeration)
      const walkBob = Math.abs(strideCos) * 0.018 * w;
      const idleBreath = Math.sin(idleTime * 1.4) * 0.003 * (1 - w);
      pelvisPivot.position.y = 0.91 + walkBob;
      pelvisPivot.rotation.y = strideSin * 0.042 * w;
      pelvisPivot.rotation.z = strideCos * 0.018 * w;

      spinePivot.rotation.x = 0.028 * w + 0.045 * r;
      spinePivot.rotation.y = -strideSin * 0.05 * w - 0.12 * r;
      spinePivot.position.y = 0.09 + idleBreath;

      backpackGroup.position.y = 0.24 + Math.sin(walkPhase * 2 - 0.5) * 0.006 * w;

      headPivot.rotation.y = -0.06 * r + Math.sin(idleTime * 0.5) * 0.015 * (1 - w);
      headPivot.rotation.x = -0.025 * r;

      const lHipPitch = strideSin * 0.34 * w;
      const lKneeBend = Math.max(0, -strideCos) * 0.62 * w + 0.03 * (1 - w);
      leftLeg.hip.rotation.x = lHipPitch;
      leftLeg.knee.rotation.x = -lKneeBend;
      leftLeg.ankle.rotation.x = (lKneeBend * 0.34 - lHipPitch * 0.24) * w;

      const rHipPitch = -strideSin * 0.34 * w;
      const rKneeBend = Math.max(0, strideCos) * 0.62 * w + 0.03 * (1 - w);
      rightLeg.hip.rotation.x = rHipPitch;
      rightLeg.knee.rotation.x = -rKneeBend;
      rightLeg.ankle.rotation.x = (rKneeBend * 0.34 - rHipPitch * 0.24) * w;

      leftArm.shoulder.rotation.x = -strideSin * 0.24 * w;
      leftArm.shoulder.rotation.z = 0.06;
      leftArm.elbow.rotation.x = 0.18 * w + 0.1;

      const rWalkShoulderX = strideSin * 0.24 * w;
      const rWalkElbowX = 0.18 * w + 0.1;

      rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(rWalkShoulderX, 0.94, r);
      rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(-0.06, 0.11, r);
      rightArm.elbow.rotation.x = THREE.MathUtils.lerp(rWalkElbowX, 0.26, r);
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
