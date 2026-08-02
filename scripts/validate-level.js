import { buildLevelGrid, POI, PATROL_ROUTE } from "../src/world/levelLayout.js";

function bfsReachable(grid, start) {
  const seen = new Set();
  const queue = [start];
  seen.add(`${start.x},${start.z}`);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dx, dz] of dirs) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      const k = `${nx},${nz}`;
      if (grid.isFloor(nx, nz) && !seen.has(k)) {
        seen.add(k);
        queue.push({ x: nx, z: nz });
      }
    }
  }
  return seen;
}

const grid = buildLevelGrid();
let floorCount = 0;
for (let z = 0; z < grid.height; z++) {
  for (let x = 0; x < grid.width; x++) {
    if (grid.isFloor(x, z)) floorCount++;
  }
}

console.log(`Grid: ${grid.width}x${grid.height}, floor cells: ${floorCount}`);

if (!grid.isFloor(POI.start.x, POI.start.z)) {
  console.error(`FAIL: start (${POI.start.x},${POI.start.z}) is not floor`);
  process.exit(1);
}

const reachable = bfsReachable(grid, POI.start);
console.log(`Reachable from start: ${reachable.size} cells`);

let ok = true;
const targets = [
  { name: "panel", ...POI.panel },
  { name: "exitDoor", ...POI.exitDoor },
  { name: "finalExit", ...POI.finalExit },
  ...POI.fuses.map((f) => ({ name: `fuse ${f.id}`, x: f.x, z: f.z })),
  ...POI.batteries.map((b) => ({ name: `battery ${b.id}`, x: b.x, z: b.z })),
  ...POI.notes.map((n) => ({ name: `note ${n.id}`, x: n.x, z: n.z })),
  ...PATROL_ROUTE.map((p, i) => ({ name: `patrol[${i}]`, x: p.x, z: p.z })),
];

for (const t of targets) {
  const isFloor = grid.isFloor(t.x, t.z);
  const isReachable = reachable.has(`${t.x},${t.z}`);
  if (!isFloor) {
    console.error(`FAIL: ${t.name} at (${t.x},${t.z}) is not a floor cell`);
    ok = false;
  } else if (!isReachable) {
    console.error(`FAIL: ${t.name} at (${t.x},${t.z}) is unreachable from start`);
    ok = false;
  } else {
    console.log(`OK: ${t.name} at (${t.x},${t.z}) reachable`);
  }
}

if (!ok) {
  console.error("\nLevel validation FAILED.");
  process.exit(1);
} else {
  console.log("\nLevel validation PASSED.");
}
