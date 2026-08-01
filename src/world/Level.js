import * as THREE from "three";
import {
  buildLevelGrid,
  ROOMS,
  POI,
  PATROL_ROUTE,
  SAFE_ZONES,
  CELL_SIZE,
  cellCenterWorld,
} from "./levelLayout.js";
import { initMaterials } from "./AssetFactory.js";

export const WALL_HEIGHT = 3.4;
export const VENT_CEILING_HEIGHT = 2.05;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Level {
  constructor() {
    this.grid = buildLevelGrid();
    this.materials = initMaterials();
    this.group = new THREE.Group();
    this.fuses = [];
    this.notes = [];
    this.batteries = [];
    this.doors = [];
    this.flickerLights = [];
    this.deadLights = [];
    this.panelLight = null;
    this.panelMesh = null;
    this.exitDoorMesh = null;
    this.exitGlowLight = null;

    this._buildFloorCeiling();
    this._buildWalls();
    this._buildVentCeilings();
    this._buildProps();
    this._buildLights();
    this._buildFuses();
    this._buildNotes();
    this._buildBatteries();
    this._buildDoors();
    this._buildPanelAndExit();
  }

  worldWidth() {
    return this.grid.width * CELL_SIZE;
  }
  worldDepth() {
    return this.grid.height * CELL_SIZE;
  }

  _buildFloorCeiling() {
    const w = this.worldWidth();
    const d = this.worldDepth();

    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floorMat = this.materials.floor;
    floorMat.map.repeat.set(w / CELL_SIZE, d / CELL_SIZE);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(w / 2, 0, d / 2);
    floor.receiveShadow = true;
    this.group.add(floor);

    const ceilGeo = new THREE.PlaneGeometry(w, d);
    const ceilMat = this.materials.ceiling;
    ceilMat.map.repeat.set(w / CELL_SIZE, d / CELL_SIZE);
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(w / 2, WALL_HEIGHT, d / 2);
    this.group.add(ceiling);
  }

  _buildWalls() {
    const { grid } = this;
    const cells = [];
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.cells[z][x] !== "#") continue;
        const neighborsFloor =
          grid.isFloor(x + 1, z) ||
          grid.isFloor(x - 1, z) ||
          grid.isFloor(x, z + 1) ||
          grid.isFloor(x, z - 1) ||
          grid.isFloor(x + 1, z + 1) ||
          grid.isFloor(x - 1, z - 1) ||
          grid.isFloor(x + 1, z - 1) ||
          grid.isFloor(x - 1, z + 1);
        if (neighborsFloor) cells.push({ x, z });
      }
    }

    const geo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallMain = new THREE.InstancedMesh(geo, this.materials.wall, cells.length);
    const wallAlt = new THREE.InstancedMesh(geo, this.materials.wallAlt, cells.length);
    let mainCount = 0;
    let altCount = 0;
    const dummy = new THREE.Object3D();
    const rng = mulberry32(777);

    for (const c of cells) {
      const center = cellCenterWorld(c.x, c.z);
      dummy.position.set(center.x, WALL_HEIGHT / 2, center.z);
      dummy.updateMatrix();
      const useAlt = rng() < 0.22;
      if (useAlt) {
        wallAlt.setMatrixAt(altCount++, dummy.matrix);
      } else {
        wallMain.setMatrixAt(mainCount++, dummy.matrix);
      }
    }
    wallMain.count = mainCount;
    wallAlt.count = altCount;
    wallMain.castShadow = true;
    wallMain.receiveShadow = true;
    wallAlt.castShadow = true;
    wallAlt.receiveShadow = true;
    this.group.add(wallMain, wallAlt);
  }

  _buildVentCeilings() {
    const cells = [...this.grid.ventCells].map((k) => {
      const [x, z] = k.split(",").map(Number);
      return { x, z };
    });
    if (!cells.length) return;
    const geo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, this.materials.ventWall, cells.length);
    const dummy = new THREE.Object3D();
    cells.forEach((c, i) => {
      const center = cellCenterWorld(c.x, c.z);
      dummy.position.set(center.x, VENT_CEILING_HEIGHT, center.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    this.group.add(mesh);
  }

  _buildProps() {
    const rng = mulberry32(42);
    const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);

    const placeCrates = (room, count) => {
      for (let i = 0; i < count; i++) {
        const x = (room.x0 + 1 + rng() * (room.x1 - room.x0 - 2)) * CELL_SIZE;
        const z = (room.z0 + 1 + rng() * (room.z1 - room.z0 - 2)) * CELL_SIZE;
        const mesh = new THREE.Mesh(crateGeo, this.materials.crate);
        mesh.position.set(x, 0.7, z);
        mesh.rotation.y = rng() * Math.PI;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    };
    placeCrates(ROOMS.storage, 6);
    placeCrates(ROOMS.entrance, 2);
    placeCrates(ROOMS.maintenance, 4);

    // Blood decals for atmosphere near the later, scarier rooms.
    const decalGeo = new THREE.PlaneGeometry(2.2, 2.2);
    decalGeo.rotateX(-Math.PI / 2);
    const decalSpots = [
      { x: ROOMS.maintenance.x0 + 3, z: ROOMS.maintenance.z0 + 3 },
      { x: ROOMS.generator.x0 + 2, z: ROOMS.generator.z0 + 2 },
      { x: 15, z: 17 },
    ];
    for (const s of decalSpots) {
      const center = cellCenterWorld(s.x, s.z);
      const mesh = new THREE.Mesh(decalGeo, this.materials.blood);
      mesh.position.set(center.x, 0.015, center.z);
      mesh.rotation.z = rng() * Math.PI * 2;
      this.group.add(mesh);
    }

    // Ceiling pipes along the hub-to-generator corridor for detail.
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, CELL_SIZE, 8);
    pipeGeo.rotateX(Math.PI / 2);
    for (let z = 17; z <= 21; z++) {
      const center = cellCenterWorld(16.5, z);
      const pipe = new THREE.Mesh(pipeGeo, this.materials.wallAlt);
      pipe.position.set(center.x, WALL_HEIGHT - 0.3, center.z);
      this.group.add(pipe);
    }
  }

  _buildLights() {
    const addRoomLight = (room, { color = 0xfff0d8, intensity = 70, distance = 0, flicker = true, on = true } = {}) => {
      const center = cellCenterWorld((room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2);
      const light = new THREE.PointLight(color, on ? intensity : 0, distance, 2);
      light.position.set(center.x, WALL_HEIGHT - 0.4, center.z);
      light.castShadow = false;
      this.group.add(light);
      if (on && flicker) {
        this.flickerLights.push({
          light,
          base: intensity,
          seed: Math.random() * 1000,
        });
      } else if (!on) {
        this.deadLights.push(light);
      }
      // Visible fixture
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.15, 0.4),
        new THREE.MeshStandardMaterial({
          color: 0x222222,
          emissive: on ? 0xfff0d8 : 0x000000,
          emissiveIntensity: on ? 1.5 : 0,
        })
      );
      fixture.position.set(center.x, WALL_HEIGHT - 0.1, center.z);
      this.group.add(fixture);
      return light;
    };

    addRoomLight(ROOMS.entrance, { intensity: 85, flicker: false });
    addRoomLight(ROOMS.hub, { intensity: 60 });
    addRoomLight(ROOMS.storage, { intensity: 60 });
    addRoomLight(ROOMS.maintenance, { intensity: 45 });
    addRoomLight(ROOMS.flooded, { intensity: 26, color: 0xbfd8ff });
    addRoomLight(ROOMS.generator, { intensity: 0, on: false });

    // A couple of extra corridor lights so navigation is possible without
    // relying solely on the flashlight in main thoroughfares.
    const corridorSpots = [
      { x: 10, z: 13.5 },
      { x: 21, z: 13.5 },
      { x: 16.5, z: 19 },
    ];
    for (const s of corridorSpots) {
      const center = cellCenterWorld(s.x, s.z);
      const light = new THREE.PointLight(0xd8c8a8, 26, 0, 2);
      light.position.set(center.x, WALL_HEIGHT - 0.4, center.z);
      this.group.add(light);
      this.flickerLights.push({ light, base: 26, seed: Math.random() * 1000 });
    }
  }

  _buildFuses() {
    const geo = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 12);
    for (const f of POI.fuses) {
      const center = cellCenterWorld(f.x, f.z);
      const group = new THREE.Group();
      group.position.set(center.x, 1.0, center.z);

      const mesh = new THREE.Mesh(geo, this.materials.fuse);
      mesh.castShadow = true;
      group.add(mesh);

      const light = new THREE.PointLight(0xd98c1f, 9, 0, 2);
      light.position.set(0, 0.3, 0);
      group.add(light);

      // small stand
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 0.9, 8),
        this.materials.wallAlt
      );
      stand.position.set(0, -0.7, 0);
      group.add(stand);

      group.userData = { id: f.id, collected: false, kind: "fuse" };
      this.group.add(group);
      this.fuses.push(group);
    }
  }

  _buildNotes() {
    const geo = new THREE.PlaneGeometry(0.4, 0.55);
    for (const n of POI.notes) {
      const center = cellCenterWorld(n.x, n.z);
      const group = new THREE.Group();
      group.position.set(center.x, 1.05, center.z);
      group.rotation.y = Math.random() * Math.PI * 2;
      group.rotation.x = -0.35;

      const mesh = new THREE.Mesh(geo, this.materials.note);
      mesh.castShadow = false;
      group.add(mesh);

      const light = new THREE.PointLight(0xfff3d6, 1.6, 0, 2);
      light.position.set(0, 0.15, 0.2);
      group.add(light);

      group.userData = {
        id: n.id,
        collected: false,
        kind: "note",
        title: n.title,
        text: n.text,
      };
      this.group.add(group);
      this.notes.push(group);
    }
  }

  _buildBatteries() {
    const geo = new THREE.BoxGeometry(0.22, 0.4, 0.16);
    for (const b of POI.batteries) {
      const center = cellCenterWorld(b.x, b.z);
      const group = new THREE.Group();
      group.position.set(center.x, 0.85, center.z);

      const mesh = new THREE.Mesh(geo, this.materials.battery);
      mesh.castShadow = true;
      group.add(mesh);

      const light = new THREE.PointLight(0x2fae7a, 5, 0, 2);
      light.position.set(0, 0.2, 0);
      group.add(light);

      group.userData = { id: b.id, collected: false, kind: "battery" };
      this.group.add(group);
      this.batteries.push(group);
    }
  }

  _buildDoors() {
    const panelW = 1.55;
    const panelH = WALL_HEIGHT * 0.82;
    const geo = new THREE.BoxGeometry(panelW, panelH, 0.18);
    for (const d of POI.doors) {
      const hinge = new THREE.Group();
      hinge.position.set(d.x, 0, d.z);

      const panel = new THREE.Mesh(geo, this.materials.door);
      panel.position.set(d.axis === "x" ? panelW / 2 : 0, panelH / 2, d.axis === "x" ? 0 : panelW / 2);
      panel.castShadow = true;
      panel.receiveShadow = true;
      hinge.add(panel);

      this.group.add(hinge);
      this.doors.push({
        hinge,
        position: new THREE.Vector3(d.x, 0, d.z),
        angle: 0,
        targetAngle: 0,
        wasOpening: false,
      });
    }
  }

  // Doors swing open on their own as the player nears them, and creak
  // shut again once they've moved on - a bit of tactile, reactive scenery.
  updateDoors(dt, playerPos, onCreak) {
    const OPEN_ANGLE = Math.PI * 0.42;
    const TRIGGER_DIST = 4.5;
    for (const door of this.doors) {
      const dist = door.position.distanceTo(playerPos);
      door.targetAngle = dist < TRIGGER_DIST ? OPEN_ANGLE : 0;
      const opening = door.targetAngle > door.angle + 0.01;
      if (opening && !door.wasOpening && onCreak) onCreak(door.position);
      door.wasOpening = opening;
      door.angle = THREE.MathUtils.lerp(door.angle, door.targetAngle, 1 - Math.pow(0.0005, dt));
      door.hinge.rotation.y = door.angle;
    }
  }

  _buildPanelAndExit() {
    const panelCenter = cellCenterWorld(POI.panel.x, POI.panel.z);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.5), this.materials.panelOff);
    panel.position.set(panelCenter.x, 0.9, panelCenter.z);
    panel.userData = { kind: "panel" };
    this.group.add(panel);
    this.panelMesh = panel;

    const panelLight = new THREE.PointLight(0x6b1414, 8, 0, 2);
    panelLight.position.set(panelCenter.x, 1.8, panelCenter.z);
    this.group.add(panelLight);
    this.panelLight = panelLight;

    const exitCenter = cellCenterWorld(POI.exitDoor.x, POI.exitDoor.z);
    const exitDoor = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE * 0.9, WALL_HEIGHT * 0.85, 0.4),
      this.materials.exitDoor
    );
    exitDoor.position.set(exitCenter.x, (WALL_HEIGHT * 0.85) / 2, exitCenter.z);
    exitDoor.userData = { kind: "exit" };
    this.group.add(exitDoor);
    this.exitDoorMesh = exitDoor;

    const exitGlow = new THREE.PointLight(0x1fae4c, 7, 0, 2);
    exitGlow.position.set(exitCenter.x, 2, exitCenter.z - CELL_SIZE);
    this.group.add(exitGlow);
    this.exitGlowLight = exitGlow;
  }

  setPanelPowered(powered) {
    this.panelMesh.material = powered ? this.materials.panelOn : this.materials.panelOff;
    this.panelLight.color.set(powered ? 0x1fae4c : 0x6b1414);
    this.panelLight.intensity = powered ? 2.5 : 1.2;
  }

  updateFlicker(time) {
    for (const f of this.flickerLights) {
      const n =
        Math.sin(time * 8 + f.seed) * 0.5 +
        Math.sin(time * 23 + f.seed * 2) * 0.3 +
        Math.sin(time * 3.3 + f.seed) * 0.2;
      const flicker = 0.75 + 0.25 * n;
      f.light.intensity = Math.max(0, f.base * flicker);
    }
  }

  isWallAtWorld(x, z) {
    const gx = Math.floor(x / CELL_SIZE);
    const gz = Math.floor(z / CELL_SIZE);
    return !this.grid.isFloor(gx, gz);
  }

  isVentAtWorld(x, z) {
    const gx = Math.floor(x / CELL_SIZE);
    const gz = Math.floor(z / CELL_SIZE);
    return this.grid.isVent(gx, gz);
  }

  spawnWorldPos() {
    const c = cellCenterWorld(POI.start.x, POI.start.z);
    return new THREE.Vector3(c.x, 1.6, c.z);
  }

  isInSafeZone(x, z) {
    const gx = Math.floor(x / CELL_SIZE);
    const gz = Math.floor(z / CELL_SIZE);
    return SAFE_ZONES.some((s) => gx >= s.x0 && gx <= s.x1 && gz >= s.z0 && gz <= s.z1);
  }
}

export { PATROL_ROUTE, POI, CELL_SIZE };
