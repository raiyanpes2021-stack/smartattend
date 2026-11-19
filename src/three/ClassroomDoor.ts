import * as THREE from 'three';
import type { CorridorTextureBundle } from './proceduralTextures';

export interface ClassroomDoorRig {
  group: THREE.Group;
  setOpenProgress: (openProgress: number, handlePress: number) => void;
  setAccessGranted: (unlocked: boolean) => void;
  dispose: () => void;
}

export function createClassroomDoor(
  textures: CorridorTextureBundle,
  isSoftwareGl: boolean,
): ClassroomDoorRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const openingWidth = 1.12;
  const openingHeight = 2.36;
  const jambDepth = 0.24;
  const frameThickness = 0.055;

  // Brushed Champagne Gold Hardware & Doorframe Trim (#D5AD70)
  const champagneGoldMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd5ad70,
      metalness: 0.82,
      roughness: 0.26,
    }),
  );

  const frameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x172b35,
      metalness: 0.25,
      roughness: 0.45,
    }),
  );

  const doorLeafMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.doorFinishColor,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.06,
    }),
  );

  const doorGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf5f0e6,
      roughness: 0.08,
      metalness: 0.0,
      transmission: isSoftwareGl ? 0 : 0.78,
      transparent: true,
      opacity: isSoftwareGl ? 0.34 : 0.92,
      ior: 1.5,
      thickness: 0.02,
      depthWrite: false,
    }),
  );

  const readerBodyMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x172b35,
      roughness: 0.38,
      metalness: 0.3,
    }),
  );

  const readerLedMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd5ad70,
      emissive: new THREE.Color(0xd5ad70),
      emissiveIntensity: 0.35,
      roughness: 0.25,
    }),
  );

  // Outer Frame: Left hinge jamb, Right latch jamb, Header
  const jambGeo = track(new THREE.BoxGeometry(frameThickness, openingHeight, jambDepth));
  const leftJamb = new THREE.Mesh(jambGeo, frameMat);
  leftJamb.position.set(frameThickness * 0.5, openingHeight * 0.5, 0);
  leftJamb.castShadow = true;
  leftJamb.receiveShadow = true;
  group.add(leftJamb);

  const rightJamb = new THREE.Mesh(jambGeo, frameMat);
  rightJamb.position.set(openingWidth - frameThickness * 0.5, openingHeight * 0.5, 0);
  rightJamb.castShadow = true;
  rightJamb.receiveShadow = true;
  group.add(rightJamb);

  const headerGeo = track(new THREE.BoxGeometry(openingWidth + 0.04, frameThickness, jambDepth));
  const headerMesh = new THREE.Mesh(headerGeo, frameMat);
  headerMesh.position.set(openingWidth * 0.5, openingHeight + frameThickness * 0.5, 0);
  headerMesh.castShadow = true;
  headerMesh.receiveShadow = true;
  group.add(headerMesh);

  // 3 Champagne Gold Barrel Hinges on Left Jamb
  const hingeGeo = track(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 12));
  [0.36, 1.18, 2.02].forEach((hy) => {
    const hinge = new THREE.Mesh(hingeGeo, champagneGoldMat);
    hinge.position.set(frameThickness + 0.004, hy, 0.032);
    group.add(hinge);
  });

  // Subtle Architectural Access Pad on Right Jamb (no flashy glow)
  const readerHousing = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.07, 0.13, 0.022)),
    readerBodyMat,
  );
  readerHousing.position.set(openingWidth + 0.09, 1.24, jambDepth * 0.5 + 0.012);
  group.add(readerHousing);

  const readerLedStrip = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.042, 0.008, 0.006)),
    readerLedMat,
  );
  readerLedStrip.position.set(openingWidth + 0.09, 1.275, jambDepth * 0.5 + 0.024);
  group.add(readerLedStrip);

  // Door Hinge Pivot at Left Inner Edge
  const leafWidth = openingWidth - frameThickness * 2;
  const leafHeight = openingHeight - 0.015;
  const leafThickness = 0.054;

  const doorHingePivot = new THREE.Group();
  doorHingePivot.position.set(frameThickness, 0, 0);
  group.add(doorHingePivot);

  const leftPanelW = 0.58;
  const glassW = 0.22;
  const rightPanelW = leafWidth - leftPanelW - glassW;
  const glassBottom = 0.72;
  const glassTop = 2.06;
  const glassH = glassTop - glassBottom;

  const leftStile = new THREE.Mesh(
    track(new THREE.BoxGeometry(leftPanelW, leafHeight, leafThickness)),
    doorLeafMat,
  );
  leftStile.position.set(leftPanelW * 0.5, leafHeight * 0.5, 0);
  leftStile.castShadow = true;
  leftStile.receiveShadow = true;
  doorHingePivot.add(leftStile);

  const rightStile = new THREE.Mesh(
    track(new THREE.BoxGeometry(rightPanelW, leafHeight, leafThickness)),
    doorLeafMat,
  );
  rightStile.position.set(leftPanelW + glassW + rightPanelW * 0.5, leafHeight * 0.5, 0);
  rightStile.castShadow = true;
  rightStile.receiveShadow = true;
  doorHingePivot.add(rightStile);

  const bottomRail = new THREE.Mesh(
    track(new THREE.BoxGeometry(glassW, glassBottom, leafThickness)),
    doorLeafMat,
  );
  bottomRail.position.set(leftPanelW + glassW * 0.5, glassBottom * 0.5, 0);
  bottomRail.castShadow = true;
  bottomRail.receiveShadow = true;
  doorHingePivot.add(bottomRail);

  const topRailH = leafHeight - glassTop;
  const topRail = new THREE.Mesh(
    track(new THREE.BoxGeometry(glassW, topRailH, leafThickness)),
    doorLeafMat,
  );
  topRail.position.set(leftPanelW + glassW * 0.5, glassTop + topRailH * 0.5, 0);
  topRail.castShadow = true;
  topRail.receiveShadow = true;
  doorHingePivot.add(topRail);

  const visionGlass = new THREE.Mesh(
    track(new THREE.BoxGeometry(glassW - 0.02, glassH - 0.02, 0.014)),
    doorGlassMat,
  );
  visionGlass.position.set(leftPanelW + glassW * 0.5, glassBottom + glassH * 0.5, 0);
  visionGlass.renderOrder = 2;
  doorHingePivot.add(visionGlass);

  // Brushed Champagne Gold Bottom Kickplate
  const kickplate = new THREE.Mesh(
    track(new THREE.BoxGeometry(leafWidth - 0.02, 0.2, leafThickness + 0.008)),
    champagneGoldMat,
  );
  kickplate.position.set(leafWidth * 0.5, 0.105, 0);
  kickplate.receiveShadow = true;
  doorHingePivot.add(kickplate);

  // Escutcheon & Champagne Gold Lever Handle Pivot
  const handleX = leafWidth - 0.085;
  const handleY = 1.01;
  const escutcheon = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.048, 0.19, leafThickness + 0.016)),
    champagneGoldMat,
  );
  escutcheon.position.set(handleX, handleY, 0);
  doorHingePivot.add(escutcheon);

  const handlePivot = new THREE.Group();
  handlePivot.position.set(handleX, handleY + 0.02, leafThickness * 0.5 + 0.012);
  doorHingePivot.add(handlePivot);

  const neckMesh = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.012, 0.014, 0.045, 14)),
    champagneGoldMat,
  );
  neckMesh.rotation.x = Math.PI * 0.5;
  neckMesh.position.set(0, 0, 0.02);
  handlePivot.add(neckMesh);

  const leverBar = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.135, 0.022, 0.018)),
    champagneGoldMat,
  );
  leverBar.position.set(-0.056, 0, 0.044);
  leverBar.castShadow = true;
  handlePivot.add(leverBar);

  return {
    group,
    setOpenProgress: (openProgress: number, handlePress: number) => {
      const clampedOpen = THREE.MathUtils.clamp(openProgress, 0, 1);
      const clampedPress = THREE.MathUtils.clamp(handlePress, 0, 1);
      doorHingePivot.rotation.y = clampedOpen * (Math.PI * 0.55);
      handlePivot.rotation.z = clampedPress * 0.4;
    },
    setAccessGranted: (unlocked: boolean) => {
      readerLedMat.emissiveIntensity = unlocked ? 0.95 : 0.3;
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
