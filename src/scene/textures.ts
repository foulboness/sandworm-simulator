import * as THREE from 'three';

export interface ProceduralTextureSet {
  titaniumMap: THREE.CanvasTexture;
  titaniumRoughness: THREE.CanvasTexture;
  titaniumNormal: THREE.CanvasTexture;
  gunmetalMap: THREE.CanvasTexture;
  gunmetalRoughness: THREE.CanvasTexture;
  gunmetalNormal: THREE.CanvasTexture;
  sandMap: THREE.CanvasTexture;
  sandNormal: THREE.CanvasTexture;
  sandRoughness: THREE.CanvasTexture;
  particleSprite: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

// Deterministic pseudo-random generator for reproducible procedural weathering
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNormalFromHeightCanvas(
  heightCanvas: HTMLCanvasElement,
  strength: number,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    return srcData[(cy * w + cx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createTitaniumTextureSet(maxAnisotropy: number) {
  const size = 512;
  const rand = mulberry32(41901);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;

  // Base brushed titanium alloy
  actx.fillStyle = '#6c737c';
  actx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#7c7c7c';
  rctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);

  // Subtle horizontal brushed metallic grain
  for (let i = 0; i < 1400; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 30 + rand() * 140;
    const bright = rand() > 0.5;
    actx.fillStyle = bright ? 'rgba(210,220,232,0.06)' : 'rgba(22,25,30,0.08)';
    actx.fillRect(x, y, len, 1.5);
    rctx.fillStyle = bright ? 'rgba(90,90,90,0.08)' : 'rgba(180,180,180,0.08)';
    rctx.fillRect(x, y, len, 1.5);
  }

  // Armor sub-panel seam lines and recessed channels
  const grid = [0, 128, 256, 384, 512];
  actx.strokeStyle = 'rgba(24, 22, 20, 0.72)';
  actx.lineWidth = 3;
  hctx.strokeStyle = '#202020';
  hctx.lineWidth = 4;
  rctx.strokeStyle = '#d8d8d8';
  rctx.lineWidth = 4;

  for (const pos of grid) {
    actx.beginPath();
    actx.moveTo(0, pos);
    actx.lineTo(size, pos);
    actx.moveTo(pos, 0);
    actx.lineTo(pos, size);
    actx.stroke();

    hctx.beginPath();
    hctx.moveTo(0, pos);
    hctx.lineTo(size, pos);
    hctx.moveTo(pos, 0);
    hctx.lineTo(pos, size);
    hctx.stroke();

    rctx.beginPath();
    rctx.moveTo(0, pos);
    rctx.lineTo(size, pos);
    rctx.moveTo(pos, 0);
    rctx.lineTo(pos, size);
    rctx.stroke();
  }

  // Desert sand & dust packed into panel joints + corrosion streaks
  for (let i = 0; i < 24; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const rad = 18 + rand() * 58;
    const g = actx.createRadialGradient(px, py, 2, px, py, rad);
    if (rand() > 0.35) {
      // Wind-packed ochre desert dust
      g.addColorStop(0, 'rgba(176, 134, 82, 0.34)');
      g.addColorStop(1, 'rgba(176, 134, 82, 0)');
    } else {
      // Oxidized iron-rust weathering
      g.addColorStop(0, 'rgba(128, 66, 36, 0.30)');
      g.addColorStop(1, 'rgba(128, 66, 36, 0)');
    }
    actx.fillStyle = g;
    actx.beginPath();
    actx.arc(px, py, rad, 0, Math.PI * 2);
    actx.fill();

    // Dust and rust increase surface roughness
    const rg = rctx.createRadialGradient(px, py, 2, px, py, rad);
    rg.addColorStop(0, 'rgba(235, 235, 235, 0.55)');
    rg.addColorStop(1, 'rgba(235, 235, 235, 0)');
    rctx.fillStyle = rg;
    rctx.beginPath();
    rctx.arc(px, py, rad, 0, Math.PI * 2);
    rctx.fill();
  }

  // Machined abrasion scratches from subterranean quartz friction
  for (let i = 0; i < 160; i++) {
    const x1 = rand() * size;
    const y1 = rand() * size;
    const angle = (rand() - 0.5) * 0.45;
    const len = 14 + rand() * 55;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;

    actx.strokeStyle = 'rgba(218, 224, 230, 0.24)';
    actx.lineWidth = 1;
    actx.beginPath();
    actx.moveTo(x1, y1);
    actx.lineTo(x2, y2);
    actx.stroke();

    rctx.strokeStyle = 'rgba(42, 42, 42, 0.4)';
    rctx.lineWidth = 1.2;
    rctx.beginPath();
    rctx.moveTo(x1, y1);
    rctx.lineTo(x2, y2);
    rctx.stroke();

    hctx.strokeStyle = '#565656';
    hctx.lineWidth = 1;
    hctx.beginPath();
    hctx.moveTo(x1, y1);
    hctx.lineTo(x2, y2);
    hctx.stroke();
  }

  // Hexagonal bolt rivets along panel perimeters
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const bx = gx * 128;
      const by = gy * 128;
      const offsets = [
        [14, 14],
        [114, 14],
        [14, 114],
        [114, 114],
        [64, 14],
        [64, 114],
      ];
      for (const [ox, oy] of offsets) {
        actx.fillStyle = '#3c424a';
        actx.beginPath();
        actx.arc(bx + ox, by + oy, 3.2, 0, Math.PI * 2);
        actx.fill();
        actx.fillStyle = '#9aa3ad';
        actx.beginPath();
        actx.arc(bx + ox - 0.8, by + oy - 0.8, 1.3, 0, Math.PI * 2);
        actx.fill();

        hctx.fillStyle = '#d4d4d4';
        hctx.beginPath();
        hctx.arc(bx + ox, by + oy, 3.2, 0, Math.PI * 2);
        hctx.fill();
      }
    }
  }

  // Subtle industrial caution chevron band near one edge
  actx.fillStyle = 'rgba(210, 128, 38, 0.28)';
  actx.fillRect(12, 244, 96, 6);

  const titaniumMap = new THREE.CanvasTexture(albedoCanvas);
  titaniumMap.colorSpace = THREE.SRGBColorSpace;
  titaniumMap.wrapS = THREE.RepeatWrapping;
  titaniumMap.wrapT = THREE.RepeatWrapping;
  titaniumMap.anisotropy = maxAnisotropy;

  const titaniumRoughness = new THREE.CanvasTexture(roughCanvas);
  titaniumRoughness.wrapS = THREE.RepeatWrapping;
  titaniumRoughness.wrapT = THREE.RepeatWrapping;
  titaniumRoughness.anisotropy = maxAnisotropy;

  const titaniumNormal = buildNormalFromHeightCanvas(heightCanvas, 2.4);
  titaniumNormal.anisotropy = maxAnisotropy;

  return { titaniumMap, titaniumRoughness, titaniumNormal };
}

function createGunmetalTextureSet(maxAnisotropy: number) {
  const size = 512;
  const rand = mulberry32(99173);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;

  actx.fillStyle = '#2b3038';
  actx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#9a9a9a';
  rctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, size, size);

  // Machined ribbing and structural louvres
  for (let y = 0; y < size; y += 32) {
    actx.fillStyle = 'rgba(12, 14, 18, 0.55)';
    actx.fillRect(0, y, size, 6);
    actx.fillStyle = 'rgba(110, 120, 134, 0.16)';
    actx.fillRect(0, y + 6, size, 2);

    hctx.fillStyle = '#383838';
    hctx.fillRect(0, y, size, 6);
    hctx.fillStyle = '#a8a8a8';
    hctx.fillRect(0, y + 6, size, 3);
  }

  // Oil grime & dust speckles
  for (let i = 0; i < 600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 5;
    actx.fillStyle = rand() > 0.65 ? 'rgba(148, 108, 66, 0.12)' : 'rgba(10, 12, 15, 0.18)';
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();

    rctx.fillStyle = rand() > 0.5 ? 'rgba(65, 65, 65, 0.25)' : 'rgba(215, 215, 215, 0.25)';
    rctx.beginPath();
    rctx.arc(x, y, r, 0, Math.PI * 2);
    rctx.fill();
  }

  const gunmetalMap = new THREE.CanvasTexture(albedoCanvas);
  gunmetalMap.colorSpace = THREE.SRGBColorSpace;
  gunmetalMap.wrapS = THREE.RepeatWrapping;
  gunmetalMap.wrapT = THREE.RepeatWrapping;
  gunmetalMap.anisotropy = maxAnisotropy;

  const gunmetalRoughness = new THREE.CanvasTexture(roughCanvas);
  gunmetalRoughness.wrapS = THREE.RepeatWrapping;
  gunmetalRoughness.wrapT = THREE.RepeatWrapping;
  gunmetalRoughness.anisotropy = maxAnisotropy;

  const gunmetalNormal = buildNormalFromHeightCanvas(heightCanvas, 2.8);
  gunmetalNormal.anisotropy = maxAnisotropy;

  return { gunmetalMap, gunmetalRoughness, gunmetalNormal };
}

function createDesertSandTextureSet(maxAnisotropy: number) {
  const size = 512;
  const rand = mulberry32(202611);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  const aImg = actx.createImageData(size, size);
  const hImg = hctx.createImageData(size, size);
  const rImg = rctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;

      // Seamless tileable wind-blown aeolian sand ripples
      const warp = Math.sin(u * 2 + Math.cos(v * 3) * 0.6) * 0.45 + Math.cos(v * 2) * 0.25;
      const ripple = Math.sin(v * 14 + warp * 2.5 + Math.sin(u * 4) * 0.6);
      const sharpRipple = Math.pow(ripple * 0.5 + 0.5, 1.35);

      const grain = (rand() - 0.5) * 0.14;
      const sparkle = rand() > 0.992 ? 0.35 : 0;

      const shade = THREE.MathUtils.clamp(0.84 + sharpRipple * 0.22 + grain, 0.55, 1.12);

      const idx = (y * size + x) * 4;
      // Rich golden Arrakis ochre sand palette
      aImg.data[idx] = Math.min(255, Math.round(214 * shade));
      aImg.data[idx + 1] = Math.min(255, Math.round(163 * shade));
      aImg.data[idx + 2] = Math.min(255, Math.round(104 * shade));
      aImg.data[idx + 3] = 255;

      const hVal = Math.round(THREE.MathUtils.clamp((sharpRipple * 0.85 + 0.08 + grain * 0.4) * 255, 0, 255));
      hImg.data[idx] = hVal;
      hImg.data[idx + 1] = hVal;
      hImg.data[idx + 2] = hVal;
      hImg.data[idx + 3] = 255;

      // Quartz sand is mostly matte (~0.88 roughness) with rare crystalline specular glints
      const rVal = Math.round(THREE.MathUtils.clamp((0.91 - sparkle - sharpRipple * 0.06) * 255, 70, 248));
      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;
    }
  }

  actx.putImageData(aImg, 0, 0);
  hctx.putImageData(hImg, 0, 0);
  rctx.putImageData(rImg, 0, 0);

  const sandMap = new THREE.CanvasTexture(albedoCanvas);
  sandMap.colorSpace = THREE.SRGBColorSpace;
  sandMap.wrapS = THREE.RepeatWrapping;
  sandMap.wrapT = THREE.RepeatWrapping;
  sandMap.repeat.set(34, 34);
  sandMap.anisotropy = maxAnisotropy;

  const sandNormal = buildNormalFromHeightCanvas(heightCanvas, 2.2);
  sandNormal.repeat.set(34, 34);
  sandNormal.anisotropy = maxAnisotropy;

  const sandRoughness = new THREE.CanvasTexture(roughCanvas);
  sandRoughness.wrapS = THREE.RepeatWrapping;
  sandRoughness.wrapT = THREE.RepeatWrapping;
  sandRoughness.repeat.set(34, 34);
  sandRoughness.anisotropy = maxAnisotropy;

  return { sandMap, sandNormal, sandRoughness };
}

function createParticleSprite(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 242, 220, 0.95)');
  grad.addColorStop(0.35, 'rgba(235, 195, 145, 0.55)');
  grad.addColorStop(0.7, 'rgba(205, 155, 102, 0.16)');
  grad.addColorStop(1, 'rgba(180, 130, 80, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(20, 12, 6, 0.72)');
  grad.addColorStop(0.5, 'rgba(28, 17, 8, 0.34)');
  grad.addColorStop(1, 'rgba(28, 17, 8, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const titanium = createTitaniumTextureSet(maxAnisotropy);
  const gunmetal = createGunmetalTextureSet(maxAnisotropy);
  const sand = createDesertSandTextureSet(maxAnisotropy);
  const particleSprite = createParticleSprite();
  const contactShadowMap = createContactShadowMap();

  const all = [
    titanium.titaniumMap,
    titanium.titaniumRoughness,
    titanium.titaniumNormal,
    gunmetal.gunmetalMap,
    gunmetal.gunmetalRoughness,
    gunmetal.gunmetalNormal,
    sand.sandMap,
    sand.sandNormal,
    sand.sandRoughness,
    particleSprite,
    contactShadowMap,
  ];

  return {
    ...titanium,
    ...gunmetal,
    ...sand,
    particleSprite,
    contactShadowMap,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
