// Simple grid BFS pathfinder. The station's grid is small (<1000 cells)
// so BFS is cheap enough to rerun several times a second.

export function bfsPath(grid, start, goal, { excludeVents = false } = {}) {
  const passable = (x, z) => {
    if (!grid.isFloor(x, z)) return false;
    if (excludeVents && grid.isVent(x, z)) return false;
    return true;
  };

  if (!passable(goal.x, goal.z)) return null;

  const key = (x, z) => `${x},${z}`;
  const startKey = key(start.x, start.z);
  const goalKey = key(goal.x, goal.z);
  if (startKey === goalKey) return [];

  const cameFrom = new Map();
  const visited = new Set([startKey]);
  const queue = [start];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let found = false;
  while (queue.length && !found) {
    const cur = queue.shift();
    for (const [dx, dz] of dirs) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      const k = key(nx, nz);
      if (visited.has(k) || !passable(nx, nz)) continue;
      visited.add(k);
      cameFrom.set(k, cur);
      if (k === goalKey) {
        found = true;
        break;
      }
      queue.push({ x: nx, z: nz });
    }
  }

  if (!visited.has(goalKey)) return null;

  const path = [];
  let curKey = goalKey;
  let cur = goal;
  while (curKey !== startKey) {
    path.push(cur);
    cur = cameFrom.get(curKey);
    if (!cur) return null;
    curKey = key(cur.x, cur.z);
  }
  path.reverse();
  return path;
}

export function findNearestReachable(grid, from, target, { excludeVents = true, maxRadius = 6 } = {}) {
  for (let r = 0; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const x = target.x + dx;
        const z = target.z + dz;
        if (excludeVents && grid.isVent(x, z)) continue;
        if (!grid.isFloor(x, z)) continue;
        const path = bfsPath(grid, from, { x, z }, { excludeVents });
        if (path) return { x, z };
      }
    }
  }
  return null;
}
