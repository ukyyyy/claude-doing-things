import * as THREE from "three";

// All textures are generated procedurally on <canvas> at runtime.
// This keeps the game fully self-contained with zero external asset
// downloads and zero licensing risk.

function makeCanvas(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(canvas, repeat = [1, 1]) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function speckle(ctx, size, rng, count, colorFn, alphaRange = [0.05, 0.25], radiusRange = [0.5, 2.5]) {
  for (let i = 0; i < count; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = radiusRange[0] + rng() * (radiusRange[1] - radiusRange[0]);
    ctx.fillStyle = colorFn(rng);
    ctx.globalAlpha = alphaRange[0] + rng() * (alphaRange[1] - alphaRange[0]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function streaks(ctx, size, rng, count, colorFn, vertical = true) {
  for (let i = 0; i < count; i++) {
    const pos = rng() * size;
    const width = 1 + rng() * 4;
    const alpha = 0.04 + rng() * 0.18;
    const len = size * (0.3 + rng() * 0.7);
    const start = rng() * (size - len);
    ctx.strokeStyle = colorFn(rng);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(pos, start);
      ctx.lineTo(pos, start + len);
    } else {
      ctx.moveTo(start, pos);
      ctx.lineTo(start + len, pos);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function makeConcreteFloorTexture(seed = 1) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  ctx.fillStyle = "#3c3a36";
  ctx.fillRect(0, 0, size, size);

  speckle(ctx, size, rng, 900, () => (rng() > 0.5 ? "#2c2b28" : "#4a4742"), [0.05, 0.2], [0.5, 1.8]);

  // panel seams
  ctx.strokeStyle = "rgba(20,18,16,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // cracks
  ctx.strokeStyle = "rgba(10,10,10,0.4)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (rng() - 0.5) * 40;
      y += (rng() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return toTexture(canvas, [10, 10]);
}

export function makeMetalWallTexture(seed = 2, tint = "#4b4d52") {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);

  // horizontal panel bands
  for (let y = 0; y < size; y += 64) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, y, size, 3);
  }
  for (let x = 0; x < size; x += 64) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(x, 0, 2, size);
  }

  streaks(ctx, size, rng, 40, () => "#8a5a2a", true); // rust streaks
  streaks(ctx, size, rng, 20, () => "#1c1c1c", true); // grime
  speckle(ctx, size, rng, 500, () => "#26221c", [0.05, 0.2], [0.5, 2]);
  speckle(ctx, size, rng, 60, () => "#c4762f", [0.1, 0.35], [1, 4]); // rust spots

  // rivets
  ctx.fillStyle = "rgba(10,10,10,0.6)";
  for (let y = 16; y < size; y += 64) {
    for (let x = 16; x < size; x += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return toTexture(canvas, [4, 2]);
}

export function makeVentWallTexture(seed = 3) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  ctx.fillStyle = "#33352f";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 4;
  for (let x = 8; x < size; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  speckle(ctx, size, rng, 300, () => "#20221d", [0.1, 0.25], [0.5, 1.5]);
  return toTexture(canvas, [2, 2]);
}

export function makeCeilingTexture(seed = 4) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  ctx.fillStyle = "#141312";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(60,58,54,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 3; i++) {
    const p = (i / 3) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  speckle(ctx, size, rng, 400, () => "#1c1a18", [0.1, 0.3], [0.5, 2]);

  return toTexture(canvas, [8, 8]);
}

export function makeCrateTexture(seed = 5) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  ctx.fillStyle = "#5a3f26";
  ctx.fillRect(0, 0, size, size);

  streaks(ctx, size, rng, 60, () => (rng() > 0.5 ? "#4a3220" : "#6b4a2e"), false);
  ctx.strokeStyle = "#2c1e12";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.moveTo(size, 0);
  ctx.lineTo(0, size);
  ctx.stroke();

  speckle(ctx, size, rng, 200, () => "#241a10", [0.1, 0.3], [0.5, 1.5]);

  return toTexture(canvas, [1, 1]);
}

export function makeBloodDecalTexture(seed = 6) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = "#3a0505";
  for (let i = 0; i < 14; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = rng() * size * 0.35;
    const r = 6 + rng() * 22;
    ctx.globalAlpha = 0.5 + rng() * 0.4;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeDoorTexture(seed = 7, glow = "#b6221c") {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  ctx.fillStyle = "#3a2f2a";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1c1512";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, size - 20, size - 20);
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(size / 2 - 20, size * 0.15, 40, 10);
  ctx.globalAlpha = 1;
  speckle(ctx, size, rng, 150, () => "#1c1512", [0.1, 0.3], [1, 3]);

  return toTexture(canvas, [1, 1]);
}

export const Materials = {};

export function initMaterials() {
  Materials.floor = new THREE.MeshStandardMaterial({
    map: makeConcreteFloorTexture(11),
    roughness: 0.95,
    metalness: 0.05,
  });
  Materials.ceiling = new THREE.MeshStandardMaterial({
    map: makeCeilingTexture(12),
    roughness: 1,
    metalness: 0,
  });
  Materials.wall = new THREE.MeshStandardMaterial({
    map: makeMetalWallTexture(13, "#4b4d52"),
    roughness: 0.75,
    metalness: 0.4,
  });
  Materials.wallAlt = new THREE.MeshStandardMaterial({
    map: makeMetalWallTexture(14, "#413a38"),
    roughness: 0.8,
    metalness: 0.3,
  });
  Materials.ventWall = new THREE.MeshStandardMaterial({
    map: makeVentWallTexture(15),
    roughness: 0.9,
    metalness: 0.2,
  });
  Materials.crate = new THREE.MeshStandardMaterial({
    map: makeCrateTexture(16),
    roughness: 0.9,
    metalness: 0,
  });
  Materials.door = new THREE.MeshStandardMaterial({
    map: makeDoorTexture(17, "#b6221c"),
    roughness: 0.6,
    metalness: 0.5,
  });
  Materials.exitDoor = new THREE.MeshStandardMaterial({
    map: makeDoorTexture(18, "#1fae4c"),
    roughness: 0.6,
    metalness: 0.5,
    emissive: new THREE.Color("#1fae4c"),
    emissiveIntensity: 0.15,
  });
  Materials.blood = new THREE.MeshStandardMaterial({
    map: makeBloodDecalTexture(19),
    transparent: true,
    depthWrite: false,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  Materials.fuse = new THREE.MeshStandardMaterial({
    color: "#d98c1f",
    emissive: "#d98c1f",
    emissiveIntensity: 1.2,
    roughness: 0.4,
    metalness: 0.3,
  });
  Materials.panelOff = new THREE.MeshStandardMaterial({
    color: "#2b2b2b",
    emissive: "#3a1010",
    emissiveIntensity: 0.4,
    roughness: 0.5,
    metalness: 0.6,
  });
  Materials.panelOn = new THREE.MeshStandardMaterial({
    color: "#2b2b2b",
    emissive: "#1fae4c",
    emissiveIntensity: 1.0,
    roughness: 0.5,
    metalness: 0.6,
  });
  return Materials;
}
