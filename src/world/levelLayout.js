// Pure data + grid logic for the "Hollow Station" level.
// No Three.js / DOM dependency here so it can be validated with plain Node.

export const CELL_SIZE = 4;

function key(x, z) {
  return `${x},${z}`;
}

export class LevelGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () => new Array(width).fill("#"));
    this.ventCells = new Set();
  }

  carveRect(x0, z0, x1, z1) {
    const xa = Math.max(0, Math.min(x0, x1));
    const xb = Math.min(this.width - 1, Math.max(x0, x1));
    const za = Math.max(0, Math.min(z0, z1));
    const zb = Math.min(this.height - 1, Math.max(z0, z1));
    for (let z = za; z <= zb; z++) {
      for (let x = xa; x <= xb; x++) {
        this.cells[z][x] = ".";
      }
    }
  }

  markVentRect(x0, z0, x1, z1) {
    this.carveRect(x0, z0, x1, z1);
    const xa = Math.max(0, Math.min(x0, x1));
    const xb = Math.min(this.width - 1, Math.max(x0, x1));
    const za = Math.max(0, Math.min(z0, z1));
    const zb = Math.min(this.height - 1, Math.max(z0, z1));
    for (let z = za; z <= zb; z++) {
      for (let x = xa; x <= xb; x++) {
        this.ventCells.add(key(x, z));
      }
    }
  }

  inBounds(x, z) {
    return x >= 0 && x < this.width && z >= 0 && z < this.height;
  }

  isFloor(x, z) {
    return this.inBounds(x, z) && this.cells[z][x] !== "#";
  }

  isVent(x, z) {
    return this.ventCells.has(key(x, z));
  }
}

export const ROOMS = {
  entrance: { x0: 2, z0: 2, x1: 9, z1: 8, name: "Entrance Hall" },
  hub: { x0: 14, z0: 12, x1: 19, z1: 17, name: "Central Junction" },
  storage: { x0: 24, z0: 2, x1: 31, z1: 9, name: "Storage Wing" },
  flooded: { x0: 2, z0: 18, x1: 9, z1: 25, name: "Flooded Corridor" },
  maintenance: { x0: 24, z0: 18, x1: 31, z1: 25, name: "Maintenance Bay" },
  generator: { x0: 14, z0: 21, x1: 19, z1: 26, name: "Generator Room" },
};

export const POI = {
  start: { x: 5, z: 5 },
  fuses: [
    { id: "A", x: 28, z: 5, room: "storage" },
    { id: "B", x: 5, z: 21, room: "flooded" },
    { id: "C", x: 28, z: 21, room: "maintenance" },
  ],
  panel: { x: 16, z: 24 },
  exitDoor: { x: 16, z: 26 },
};

export const PATROL_ROUTE = [
  { x: 16, z: 14 },
  { x: 19, z: 14 },
  { x: 21, z: 14 },
  { x: 23, z: 12 },
  { x: 27, z: 6 },
  { x: 27, z: 4 },
  { x: 24, z: 9 },
  { x: 19, z: 14 },
  { x: 16, z: 16 },
  { x: 19, z: 17 },
  { x: 21, z: 17 },
  { x: 24, z: 19 },
  { x: 27, z: 21 },
  { x: 27, z: 24 },
  { x: 24, z: 19 },
];

export const SAFE_ZONES = [
  { x0: 2, z0: 2, x1: 9, z1: 8 }, // entrance hall - starting light
];

export function buildLevelGrid() {
  const grid = new LevelGrid(34, 29);

  for (const r of Object.values(ROOMS)) {
    grid.carveRect(r.x0, r.z0, r.x1, r.z1);
  }

  // Corridors
  grid.carveRect(5, 9, 6, 14); // C1a: entrance -> south
  grid.carveRect(7, 13, 14, 14); // C1b: -> hub west wall
  grid.carveRect(19, 13, 24, 14); // C2a: hub -> east
  grid.carveRect(23, 9, 24, 14); // C2b: -> storage bottom wall
  grid.carveRect(6, 16, 14, 17); // C3: hub -> flooded corridor
  grid.carveRect(19, 16, 24, 17); // C4: hub -> maintenance
  grid.carveRect(16, 17, 17, 21); // C5: hub -> generator room

  // Vent shortcut (player-only: enemy pathfinding excludes these cells)
  grid.markVentRect(9, 3, 30, 4); // horizontal run
  grid.markVentRect(29, 4, 30, 17); // turn south toward maintenance bay

  return grid;
}

export function cellCenterWorld(x, z) {
  return { x: x * CELL_SIZE + CELL_SIZE / 2, z: z * CELL_SIZE + CELL_SIZE / 2 };
}
