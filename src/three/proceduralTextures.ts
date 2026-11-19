import * as THREE from 'three';

export interface CorridorTextureBundle {
  terrazzoColor: THREE.CanvasTexture;
  tealSlateColor: THREE.CanvasTexture;
  doorFinishColor: THREE.CanvasTexture;
  fabricColor: THREE.CanvasTexture;
  roomPlaqueTexture: THREE.CanvasTexture;
  teachingBoardTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  dispose: () => void;
}

export function createCorridorTextures(maxAnisotropy: number): CorridorTextureBundle {
  const created: THREE.Texture[] = [];

  const registerColor = (
    canvas: HTMLCanvasElement,
    repeatX = 1,
    repeatY = 1,
  ): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAnisotropy;
    created.push(tex);
    return tex;
  };

  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // 1. Warm Ivory Terrazzo Floor Texture (#F5F0E6 base with subtle #172B35 & #D5AD70 mineral flecks)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fCtx = floorCanvas.getContext('2d')!;
  fCtx.fillStyle = '#EAE4D8';
  fCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 0.8 + rand() * 2.4;
    const pick = rand();
    if (pick < 0.42) fCtx.fillStyle = 'rgba(23, 43, 53, 0.14)';
    else if (pick < 0.72) fCtx.fillStyle = 'rgba(213, 173, 112, 0.20)';
    else fCtx.fillStyle = 'rgba(245, 240, 230, 0.75)';
    fCtx.beginPath();
    fCtx.arc(x, y, r, 0, Math.PI * 2);
    fCtx.fill();
  }

  fCtx.strokeStyle = 'rgba(23, 43, 53, 0.14)';
  fCtx.lineWidth = 2;
  for (let g = 0; g <= 512; g += 128) {
    fCtx.beginPath();
    fCtx.moveTo(g, 0);
    fCtx.lineTo(g, 512);
    fCtx.stroke();
    fCtx.beginPath();
    fCtx.moveTo(0, g);
    fCtx.lineTo(512, g);
    fCtx.stroke();
  }
  const terrazzoColor = registerColor(floorCanvas, 3, 12);

  // 2. Deep Teal Architectural Slate Panels (#172B35 subtle natural slate texture)
  const slateCanvas = document.createElement('canvas');
  slateCanvas.width = 256;
  slateCanvas.height = 256;
  const sCtx = slateCanvas.getContext('2d')!;
  sCtx.fillStyle = '#172B35';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 280; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const w = 12 + rand() * 44;
    const h = 4 + rand() * 14;
    sCtx.fillStyle = rand() > 0.5 ? 'rgba(245, 240, 230, 0.025)' : 'rgba(12, 22, 28, 0.18)';
    sCtx.fillRect(x, y, w, h);
  }
  // Subtle vertical architectural panel seams
  sCtx.fillStyle = 'rgba(10, 18, 22, 0.35)';
  for (let x = 0; x < 256; x += 64) {
    sCtx.fillRect(x, 0, 2, 256);
  }
  const tealSlateColor = registerColor(slateCanvas, 6, 1);

  // 3. Architectural Door Finish (Warm Deep Teal-Walnut Satin)
  const doorCanvas = document.createElement('canvas');
  doorCanvas.width = 256;
  doorCanvas.height = 512;
  const dCtx = doorCanvas.getContext('2d')!;
  dCtx.fillStyle = '#243944';
  dCtx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 160; i++) {
    const x = rand() * 256;
    const w = 1 + rand() * 2.5;
    dCtx.fillStyle = rand() > 0.5 ? 'rgba(245, 240, 230, 0.035)' : 'rgba(15, 28, 35, 0.18)';
    dCtx.fillRect(x, 0, w, 512);
  }
  const doorFinishColor = registerColor(doorCanvas, 1, 1);

  // 4. Woven Jacket Fabric (Deep Teal Tailored Wool/Cotton)
  const fabCanvas = document.createElement('canvas');
  fabCanvas.width = 128;
  fabCanvas.height = 128;
  const fbCtx = fabCanvas.getContext('2d')!;
  fbCtx.fillStyle = '#1B313C';
  fbCtx.fillRect(0, 0, 128, 128);
  fbCtx.strokeStyle = 'rgba(245, 240, 230, 0.045)';
  fbCtx.lineWidth = 1;
  for (let i = 0; i < 128; i += 4) {
    fbCtx.beginPath();
    fbCtx.moveTo(i, 0);
    fbCtx.lineTo(i, 128);
    fbCtx.stroke();
    fbCtx.beginPath();
    fbCtx.moveTo(0, i);
    fbCtx.lineTo(128, i);
    fbCtx.stroke();
  }
  const fabricColor = registerColor(fabCanvas, 4, 4);

  // 5. Quiet Architectural Room Plaque (Deep Teal, Warm Ivory, Champagne Gold)
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 512;
  plaqueCanvas.height = 256;
  const pCtx = plaqueCanvas.getContext('2d')!;
  pCtx.fillStyle = '#172B35';
  pCtx.fillRect(0, 0, 512, 256);
  pCtx.strokeStyle = '#D5AD70';
  pCtx.lineWidth = 5;
  pCtx.strokeRect(14, 14, 484, 228);

  pCtx.fillStyle = '#D5AD70';
  pCtx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  pCtx.fillText('ENGINEERING HALL · 204', 42, 78);

  pCtx.fillStyle = '#F5F0E6';
  pCtx.font = '600 44px "Plus Jakarta Sans", sans-serif';
  pCtx.fillText('LECTURE ROOM', 42, 148);

  pCtx.fillStyle = 'rgba(245, 240, 230, 0.72)';
  pCtx.font = '500 20px "DM Sans", sans-serif';
  pCtx.fillText('SMARTATTEND ENABLED', 42, 198);
  const roomPlaqueTexture = registerColor(plaqueCanvas, 1, 1);
  roomPlaqueTexture.wrapS = THREE.ClampToEdgeWrapping;
  roomPlaqueTexture.wrapT = THREE.ClampToEdgeWrapping;

  // 6. Classroom Matte Teaching Board Texture (#172B35 slate surface with subtle matte chalk dust & minimal SMARTATTEND header)
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024;
  boardCanvas.height = 512;
  const bCtx = boardCanvas.getContext('2d')!;
  bCtx.fillStyle = '#172B35';
  bCtx.fillRect(0, 0, 1024, 512);

  // Subtle matte slate shading
  const boardGrad = bCtx.createRadialGradient(512, 220, 40, 512, 256, 560);
  boardGrad.addColorStop(0, 'rgba(245, 240, 230, 0.055)');
  boardGrad.addColorStop(1, 'rgba(12, 24, 30, 0.25)');
  bCtx.fillStyle = boardGrad;
  bCtx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 650; i++) {
    const x = rand() * 1024;
    const y = rand() * 512;
    const w = 4 + rand() * 24;
    bCtx.fillStyle = 'rgba(245, 240, 230, 0.014)';
    bCtx.fillRect(x, y, w, 2);
  }

  // Minimal centered SMARTATTEND title etched cleanly on the board so the zoom lands right on it
  bCtx.textAlign = 'center';
  bCtx.fillStyle = '#F5F0E6';
  bCtx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  bCtx.fillText('SMARTATTEND', 512, 178);

  bCtx.fillStyle = '#D5AD70';
  bCtx.font = '500 18px "DM Sans", sans-serif';
  bCtx.fillText('Smart Attendance. Zero Smartphones.', 512, 214);

  bCtx.strokeStyle = 'rgba(213, 173, 112, 0.35)';
  bCtx.lineWidth = 1.5;
  bCtx.beginPath();
  bCtx.moveTo(392, 238);
  bCtx.lineTo(632, 238);
  bCtx.stroke();

  const teachingBoardTexture = registerColor(boardCanvas, 1, 1);
  teachingBoardTexture.wrapS = THREE.ClampToEdgeWrapping;
  teachingBoardTexture.wrapT = THREE.ClampToEdgeWrapping;

  // 7. Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shCtx = shadowCanvas.getContext('2d')!;
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(14, 26, 32, 0.55)');
  grad.addColorStop(0.55, 'rgba(14, 26, 32, 0.22)');
  grad.addColorStop(1, 'rgba(14, 26, 32, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);
  created.push(contactShadowTexture);

  return {
    terrazzoColor,
    tealSlateColor,
    doorFinishColor,
    fabricColor,
    roomPlaqueTexture,
    teachingBoardTexture,
    contactShadowTexture,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
