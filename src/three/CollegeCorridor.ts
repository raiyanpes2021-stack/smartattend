import * as THREE from 'three';
import { createClassroomDoor, type ClassroomDoorRig } from './ClassroomDoor';
import type { CorridorTextureBundle } from './proceduralTextures';

export interface CollegeCorridorRig {
  group: THREE.Group;
  door: ClassroomDoorRig;
  classroomLightIntensity: (factor: number) => void;
  dispose: () => void;
}

export function createCollegeCorridor(
  textures: CorridorTextureBundle,
  isSoftwareGl: boolean,
): CollegeCorridorRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Strict 3-color architectural palette: Deep Teal (#172B35), Warm Ivory (#F5F0E6), Champagne Gold (#D5AD70)
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.terrazzoColor,
      roughness: 0.32,
      metalness: 0.04,
    }),
  );

  const ivoryPlasterMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5f0e6,
      roughness: 0.88,
      metalness: 0.01,
    }),
  );

  const deepTealSlateMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.tealSlateColor,
      roughness: 0.68,
      metalness: 0.06,
    }),
  );

  const ceilingPanelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xebe4d8,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );

  const champagneTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd5ad70,
      roughness: 0.3,
      metalness: 0.78,
    }),
  );

  const warmDaylightPaneMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5f0e6,
      emissive: new THREE.Color(0xf5f0e6),
      emissiveIntensity: 0.9,
      roughness: 0.25,
    }),
  );

  const sidelightGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf5f0e6,
      roughness: 0.1,
      metalness: 0.0,
      transmission: isSoftwareGl ? 0 : 0.8,
      transparent: true,
      opacity: isSoftwareGl ? 0.26 : 0.9,
      ior: 1.5,
      thickness: 0.02,
      depthWrite: false,
    }),
  );

  // 1. Continuous Floor (Corridor + Classroom)
  const corridorW = 3.8;
  const corridorH = 3.35;
  const corridorLen = 20.5;

  const corridorFloor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(corridorW, corridorLen)),
    floorMat,
  );
  corridorFloor.rotation.x = -Math.PI * 0.5;
  corridorFloor.position.set(0, 0, -2.0);
  corridorFloor.receiveShadow = true;
  group.add(corridorFloor);

  const classroomFloor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(9.2, 11.4)),
    floorMat,
  );
  classroomFloor.rotation.x = -Math.PI * 0.5;
  classroomFloor.position.set(0, 0.001, -17.7);
  classroomFloor.receiveShadow = true;
  group.add(classroomFloor);

  // 2. Quiet Engineering Corridor Side Walls
  const buildSideWall = (xPos: number, sideSign: number, hasWindows: boolean) => {
    const wallGroup = new THREE.Group();
    wallGroup.position.set(xPos, 0, -2.0);

    // Lower Deep Teal acoustic wainscot
    const wainscot = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.08, 1.18, corridorLen)),
      deepTealSlateMat,
    );
    wainscot.position.set(0, 0.59, 0);
    wainscot.receiveShadow = true;
    wallGroup.add(wainscot);

    // Champagne Gold chair rail
    const rail = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.1, 0.04, corridorLen)),
      champagneTrimMat,
    );
    rail.position.set(0, 1.2, 0);
    wallGroup.add(rail);

    // Upper Warm Ivory architectural plaster
    const upper = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.08, corridorH - 1.22, corridorLen)),
      ivoryPlasterMat,
    );
    upper.position.set(0, 1.22 + (corridorH - 1.22) * 0.5, 0);
    upper.receiveShadow = true;
    wallGroup.add(upper);

    // Baseboard trim
    const base = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.1, 0.1, corridorLen)),
      deepTealSlateMat,
    );
    base.position.set(0, 0.05, 0);
    wallGroup.add(base);

    // Architectural Deep Teal pilasters
    const pilasterGeo = track(new THREE.BoxGeometry(0.14, corridorH, 0.2));
    for (let z = 6.2; z >= -9.8; z -= 3.4) {
      const pilaster = new THREE.Mesh(pilasterGeo, deepTealSlateMat);
      pilaster.position.set(sideSign * -0.02, corridorH * 0.5, z);
      pilaster.castShadow = true;
      pilaster.receiveShadow = true;
      wallGroup.add(pilaster);
    }

    if (hasWindows) {
      // Natural daylight clerestory windows on Left wall
      [-0.6, -4.0, -7.4].forEach((wz) => {
        const winFrame = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.06, 1.38, 1.95)),
          deepTealSlateMat,
        );
        winFrame.position.set(sideSign * -0.03, 2.02, wz);
        wallGroup.add(winFrame);

        const winPane = new THREE.Mesh(
          track(new THREE.PlaneGeometry(1.82, 1.26)),
          warmDaylightPaneMat,
        );
        winPane.rotation.y = Math.PI * 0.5;
        winPane.position.set(sideSign * -0.065, 2.02, wz);
        wallGroup.add(winPane);
      });
    } else {
      // Recessed classroom doors along Right wall
      const sideDoorMat = track(
        new THREE.MeshStandardMaterial({
          map: textures.doorFinishColor,
          roughness: 0.48,
          metalness: 0.06,
        }),
      );
      [1.0, -5.8].forEach((dz) => {
        const frame = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.12, 2.34, 1.08)),
          deepTealSlateMat,
        );
        frame.position.set(sideSign * -0.02, 1.17, dz);
        wallGroup.add(frame);

        const leaf = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.13, 2.26, 0.98)),
          sideDoorMat,
        );
        leaf.position.set(sideSign * -0.025, 1.13, dz);
        wallGroup.add(leaf);
      });
    }

    group.add(wallGroup);
  };

  buildSideWall(-corridorW * 0.5, -1, true);
  buildSideWall(corridorW * 0.5, 1, false);

  // 3. Corridor Ceiling & Soft Recessed Daylight Ceiling Fixtures
  const corridorCeiling = new THREE.Mesh(
    track(new THREE.PlaneGeometry(corridorW, corridorLen)),
    ceilingPanelMat,
  );
  corridorCeiling.rotation.x = Math.PI * 0.5;
  corridorCeiling.position.set(0, corridorH, -2.0);
  group.add(corridorCeiling);

  for (let z = 4.5; z >= -10.5; z -= 3.2) {
    const beam = new THREE.Mesh(
      track(new THREE.BoxGeometry(corridorW, 0.12, 0.2)),
      deepTealSlateMat,
    );
    beam.position.set(0, corridorH - 0.06, z + 1.6);
    group.add(beam);

    const fixture = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.35, 0.025, 0.16)),
      warmDaylightPaneMat,
    );
    fixture.position.set(0, corridorH - 0.012, z);
    group.add(fixture);

    const pLight = new THREE.PointLight(0xf5f0e6, 1.55, 7.5, 1.7);
    pLight.position.set(0, corridorH - 0.25, z);
    group.add(pLight);
  }

  // 4. End-of-Corridor Classroom Portal Wall at z = -12.0
  const lowerLeftPartition = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.55, 1.18, 0.22)),
    deepTealSlateMat,
  );
  lowerLeftPartition.position.set(-1.125, 0.59, -12.0);
  lowerLeftPartition.castShadow = true;
  lowerLeftPartition.receiveShadow = true;
  group.add(lowerLeftPartition);

  const leftGlassSill = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.55, 0.045, 0.24)),
    champagneTrimMat,
  );
  leftGlassSill.position.set(-1.125, 1.202, -12.0);
  group.add(leftGlassSill);

  const leftSidelightGlass = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.48, 1.15, 0.02)),
    sidelightGlassMat,
  );
  leftSidelightGlass.position.set(-1.125, 1.795, -12.0);
  leftSidelightGlass.renderOrder = 2;
  group.add(leftSidelightGlass);

  // Subtle Room 204 Plaque
  const plaqueMesh = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.58, 0.29, 0.022)),
    track(
      new THREE.MeshStandardMaterial({
        map: textures.roomPlaqueTexture,
        roughness: 0.35,
      }),
    ),
  );
  plaqueMesh.position.set(-0.78, 1.5, -11.875);
  group.add(plaqueMesh);

  // Right column beside door
  const rightColumn = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.13, corridorH, 0.22)),
    deepTealSlateMat,
  );
  rightColumn.position.set(1.335, corridorH * 0.5, -12.0);
  rightColumn.castShadow = true;
  rightColumn.receiveShadow = true;
  group.add(rightColumn);

  const headerSpandrel = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.67, corridorH - 2.38, 0.22)),
    ivoryPlasterMat,
  );
  headerSpandrel.position.set(-0.565, 2.38 + (corridorH - 2.38) * 0.5, -12.0);
  group.add(headerSpandrel);

  // 5. Physical 3D Classroom Door mounted at opening x = -0.35 -> +0.77
  const door = createClassroomDoor(textures, isSoftwareGl);
  door.group.position.set(-0.35, 0, -12.0);
  group.add(door.group);

  // 6. Realistic Engineering Classroom Interior (z = -12.1 to -22.5)
  const classBackWall = new THREE.Mesh(
    track(new THREE.PlaneGeometry(9.2, 3.6)),
    ivoryPlasterMat,
  );
  classBackWall.position.set(0, 1.8, -22.4);
  classBackWall.receiveShadow = true;
  group.add(classBackWall);

  // Left & Right Classroom Walls
  const classLeftWall = new THREE.Mesh(
    track(new THREE.PlaneGeometry(11.0, 3.6)),
    ivoryPlasterMat,
  );
  classLeftWall.rotation.y = Math.PI * 0.5;
  classLeftWall.position.set(-4.5, 1.8, -17.2);
  group.add(classLeftWall);

  // Natural Classroom Daylight Windows along Left Wall
  [-15.0, -18.2, -20.8].forEach((wz) => {
    const cWinFrame = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.08, 1.65, 2.1)),
      deepTealSlateMat,
    );
    cWinFrame.position.set(-4.46, 1.85, wz);
    group.add(cWinFrame);

    const cWinPane = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.94, 1.5)),
      warmDaylightPaneMat,
    );
    cWinPane.rotation.y = Math.PI * 0.5;
    cWinPane.position.set(-4.41, 1.85, wz);
    group.add(cWinPane);
  });

  const classRightWall = new THREE.Mesh(
    track(new THREE.PlaneGeometry(11.0, 3.6)),
    deepTealSlateMat,
  );
  classRightWall.rotation.y = -Math.PI * 0.5;
  classRightWall.position.set(4.5, 1.8, -17.2);
  group.add(classRightWall);

  const classCeiling = new THREE.Mesh(
    track(new THREE.PlaneGeometry(9.2, 11.0)),
    ceilingPanelMat,
  );
  classCeiling.rotation.x = Math.PI * 0.5;
  classCeiling.position.set(0, 3.55, -17.2);
  group.add(classCeiling);

  // Centerpiece Classroom Teaching Board (z = -22.34, y = 1.72, 5.4m x 2.7m)
  // Framed in brushed Champagne Gold (#D5AD70) with matte Deep Teal (#172B35) slate board surface
  const boardOuterFrame = new THREE.Mesh(
    track(new THREE.BoxGeometry(5.6, 2.86, 0.06)),
    champagneTrimMat,
  );
  boardOuterFrame.position.set(0, 1.72, -22.35);
  group.add(boardOuterFrame);

  const boardChalkTray = new THREE.Mesh(
    track(new THREE.BoxGeometry(5.64, 0.06, 0.14)),
    champagneTrimMat,
  );
  boardChalkTray.position.set(0, 0.31, -22.29);
  group.add(boardChalkTray);

  const boardSurface = new THREE.Mesh(
    track(new THREE.PlaneGeometry(5.4, 2.7)),
    track(
      new THREE.MeshStandardMaterial({
        map: textures.teachingBoardTexture,
        roughness: 0.78,
        metalness: 0.02,
      }),
    ),
  );
  boardSurface.position.set(0, 1.72, -22.315);
  group.add(boardSurface);

  // Subtle Overhead AI Camera Unit above the Teaching Board (Deep Teal + Champagne Gold ring)
  const camArm = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12)),
    champagneTrimMat,
  );
  camArm.position.set(0, 3.36, -21.9);
  group.add(camArm);

  const camHousing = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.095, 0.072, 0.14, 18)),
    deepTealSlateMat,
  );
  camHousing.rotation.x = Math.PI * 0.35;
  camHousing.position.set(0, 3.26, -21.88);
  group.add(camHousing);

  const camRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.058, 0.008, 8, 24)),
    champagneTrimMat,
  );
  camRing.rotation.x = Math.PI * 0.35;
  camRing.position.set(0, 3.22, -21.82);
  group.add(camRing);

  // Classroom Desks & Chairs (leaving central aisle clear for smooth camera movement, student walks to left row!)
  const deskTopMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe6decb,
      roughness: 0.45,
      metalness: 0.02,
    }),
  );
  const deskLegGeo = track(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 10));
  const deskTopGeo = track(new THREE.BoxGeometry(1.52, 0.04, 0.56));
  const chairSeatGeo = track(new THREE.BoxGeometry(0.44, 0.04, 0.42));
  const chairBackGeo = track(new THREE.BoxGeometry(0.44, 0.42, 0.04));

  const deskRows = [-14.8, -16.8, -18.8];
  const deskCols = [-1.75, 1.75];
  deskRows.forEach((rz) => {
    deskCols.forEach((cx) => {
      const deskGroup = new THREE.Group();
      deskGroup.position.set(cx, 0, rz);

      const top = new THREE.Mesh(deskTopGeo, deskTopMat);
      top.position.set(0, 0.74, 0);
      top.castShadow = true;
      top.receiveShadow = true;
      deskGroup.add(top);

      [
        [-0.68, -0.22],
        [0.68, -0.22],
        [-0.68, 0.22],
        [0.68, 0.22],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(deskLegGeo, deepTealSlateMat);
        leg.position.set(lx, 0.36, lz);
        deskGroup.add(leg);
      });

      [-0.38, 0.38].forEach((seatX) => {
        const seat = new THREE.Mesh(chairSeatGeo, deepTealSlateMat);
        seat.position.set(seatX, 0.44, 0.44);
        deskGroup.add(seat);

        const back = new THREE.Mesh(chairBackGeo, deepTealSlateMat);
        back.position.set(seatX, 0.67, 0.63);
        deskGroup.add(back);
      });

      group.add(deskGroup);
    });
  });

  // Natural Warm Classroom Daylight Illumination spilling softly into the corridor when door opens
  const classDaylightMain = new THREE.PointLight(0xf5f0e6, 2.8, 16, 1.4);
  classDaylightMain.position.set(-1.2, 2.9, -15.2);
  group.add(classDaylightMain);

  const classDaylightFront = new THREE.PointLight(0xf5f0e6, 3.2, 16, 1.4);
  classDaylightFront.position.set(0, 2.95, -19.8);
  group.add(classDaylightFront);

  const spillSpot = new THREE.SpotLight(0xf5f0e6, 0, 11, Math.PI * 0.3, 0.72, 1.4);
  spillSpot.position.set(0.15, 2.2, -13.6);
  spillSpot.target.position.set(0.1, 0, -9.6);
  group.add(spillSpot);
  group.add(spillSpot.target);

  return {
    group,
    door,
    classroomLightIntensity: (factor: number) => {
      const f = THREE.MathUtils.clamp(factor, 0, 1);
      classDaylightMain.intensity = 2.4 + f * 3.4;
      classDaylightFront.intensity = 2.8 + f * 2.6;
      spillSpot.intensity = f * 6.5;
    },
    dispose: () => {
      door.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
