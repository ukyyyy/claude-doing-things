import * as THREE from "three";
import { PATROL_ROUTE, CELL_SIZE } from "../world/Level.js";
import { bfsPath, findNearestReachable } from "./Pathfinder.js";

const STATE = {
  PATROL: "PATROL",
  INVESTIGATE: "INVESTIGATE",
  CHASE: "CHASE",
  SEARCH: "SEARCH",
};

const SPEEDS = {
  PATROL: 1.9,
  INVESTIGATE: 2.6,
  CHASE: 4.5,
  SEARCH: 2.3,
};

const VISION_RANGE_BASE = 11;
const VISION_RANGE_LIT = 17; // when player's flashlight is on, it sees further
const VISION_HALF_ANGLE = Math.PI * 0.32;
const CLOSE_SENSE_RADIUS = 2.2; // always "feels" the player this close regardless of facing
const CATCH_DISTANCE = 1.05;
const PATH_REPATH_INTERVAL = 0.4;
const WAYPOINT_ARRIVE_DIST = 0.35;

function worldToGrid(x, z) {
  return { x: Math.floor(x / CELL_SIZE), z: Math.floor(z / CELL_SIZE) };
}
function gridCenterWorld(x, z) {
  return { x: x * CELL_SIZE + CELL_SIZE / 2, z: z * CELL_SIZE + CELL_SIZE / 2 };
}

export class Stalker {
  constructor(level) {
    this.level = level;
    this.state = STATE.PATROL;
    this.patrolIndex = 0;
    this.waitTimer = 0;
    this.path = [];
    this.repathTimer = 0;
    this.lastKnownPlayerCell = null;
    this.searchTimer = 0;
    this.facing = new THREE.Vector3(0, 0, -1);
    this.animTime = Math.random() * 10;

    const startWp = PATROL_ROUTE[0];
    const c = gridCenterWorld(startWp.x, startWp.z);
    this.position = new THREE.Vector3(c.x, 0, c.z);

    this.group = this._buildMesh();
    this.group.position.copy(this.position);

    this.caughtPlayer = false;
  }

  _buildMesh() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0a0c, roughness: 0.85, metalness: 0.1 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x220000,
      emissive: 0xff2b1f,
      emissiveIntensity: 2.5,
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.05, 4, 8), dark);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    this.torso = torso;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), dark);
    head.scale.set(0.85, 1.15, 0.9);
    head.position.y = 1.85;
    group.add(head);
    this.head = head;

    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.075, 1.86, -0.19);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.075, 1.86, -0.19);
    group.add(eyeL, eyeR);

    const eyeLight = new THREE.PointLight(0xff2b1f, 0, 4, 2);
    eyeLight.position.set(0, 1.86, -0.15);
    group.add(eyeLight);
    this.eyeLight = eyeLight;

    const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.95, 6);
    armGeo.translate(0, -0.475, 0);
    this.armL = new THREE.Mesh(armGeo, dark);
    this.armL.position.set(-0.34, 1.65, 0);
    this.armR = new THREE.Mesh(armGeo, dark);
    this.armR.position.set(0.34, 1.65, 0);
    group.add(this.armL, this.armR);

    const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.95, 6);
    legGeo.translate(0, -0.475, 0);
    this.legL = new THREE.Mesh(legGeo, dark);
    this.legL.position.set(-0.14, 0.95, 0);
    this.legR = new THREE.Mesh(legGeo, dark);
    this.legR.position.set(0.14, 0.95, 0);
    this.legR.geometry.translate(0, -0.475, 0);
    group.add(this.legL, this.legR);

    return group;
  }

  _setState(next) {
    if (this.state !== next) {
      this.state = next;
      this.path = [];
      this.repathTimer = 0;
    }
  }

  registerNoise(worldPos, radius) {
    if (this.state === STATE.CHASE) return;
    const dist = this.position.distanceTo(worldPos);
    if (dist <= radius) {
      this.lastKnownPlayerCell = worldToGrid(worldPos.x, worldPos.z);
      this._setState(STATE.INVESTIGATE);
      this.searchTimer = 0;
    }
  }

  _hasLineOfSight(playerPos) {
    const from = this.position.clone().setY(1.6);
    const to = playerPos.clone().setY(1.6);
    const dist = from.distanceTo(to);
    const steps = Math.ceil(dist / 0.4);
    const dir = to.clone().sub(from).multiplyScalar(1 / steps);
    const p = from.clone();
    for (let i = 0; i < steps; i++) {
      p.add(dir);
      if (this.level.isWallAtWorld(p.x, p.z)) return false;
    }
    return true;
  }

  _canSensePlayer(player) {
    const playerPos = player.camera.position;
    const dist = this.position.distanceTo(playerPos);
    if (dist <= CLOSE_SENSE_RADIUS && this._hasLineOfSight(playerPos)) return true;

    const visionRange = player.flashlightOn ? VISION_RANGE_LIT : VISION_RANGE_BASE;
    if (dist > visionRange) return false;

    const toPlayer = playerPos.clone().sub(this.position).setY(0).normalize();
    const facing = this.facing.clone().setY(0).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(facing.dot(toPlayer), -1, 1));
    if (angle > VISION_HALF_ANGLE) return false;

    // Crouching in shadow makes the player harder to spot at range.
    const stealthPenalty = player.crouching ? 0.55 : 1;
    if (dist > visionRange * stealthPenalty) return false;

    return this._hasLineOfSight(playerPos);
  }

  _followPath(dt, speed) {
    if (!this.path.length) return true;
    const wp = this.path[0];
    const target = gridCenterWorld(wp.x, wp.z);
    const to = new THREE.Vector3(target.x - this.position.x, 0, target.z - this.position.z);
    const dist = to.length();
    if (dist < WAYPOINT_ARRIVE_DIST) {
      this.path.shift();
      return this.path.length === 0;
    }
    to.normalize();
    this.facing.copy(to);
    const step = Math.min(dist, speed * dt);
    this.position.x += to.x * step;
    this.position.z += to.z * step;
    return false;
  }

  update(dt, player) {
    this.animTime += dt;
    const grid = this.level.grid;
    const myCell = worldToGrid(this.position.x, this.position.z);
    const playerCell = worldToGrid(player.camera.position.x, player.camera.position.z);
    const sensesPlayer = this._canSensePlayer(player);

    if (sensesPlayer) {
      this._setState(STATE.CHASE);
      this.lastKnownPlayerCell = playerCell;
      this.searchTimer = 0;
    }

    this.repathTimer -= dt;

    if (this.state === STATE.CHASE) {
      if (this.repathTimer <= 0) {
        this.repathTimer = PATH_REPATH_INTERVAL;
        let goal = playerCell;
        let path = bfsPath(grid, myCell, goal, { excludeVents: true });
        if (!path) {
          const alt = findNearestReachable(grid, myCell, goal, { excludeVents: true });
          path = alt ? bfsPath(grid, myCell, alt, { excludeVents: true }) : null;
        }
        this.path = path || [];
      }
      const arrived = this._followPath(dt, SPEEDS.CHASE);
      if (!sensesPlayer && arrived) {
        this._setState(STATE.SEARCH);
        this.searchTimer = 4.5;
      } else if (!sensesPlayer) {
        // keep pursuing last known path but start counting down; if we run
        // out of path entirely and still can't see the player, drop to search
        this.searchTimer = 4.5;
      }
      const dist = this.position.distanceTo(player.camera.position);
      if (dist < CATCH_DISTANCE && sensesPlayer) {
        this.caughtPlayer = true;
      }
    } else if (this.state === STATE.INVESTIGATE) {
      if (this.repathTimer <= 0 && this.lastKnownPlayerCell) {
        this.repathTimer = PATH_REPATH_INTERVAL * 2;
        this.path = bfsPath(grid, myCell, this.lastKnownPlayerCell, { excludeVents: true }) || [];
      }
      const arrived = this._followPath(dt, SPEEDS.INVESTIGATE);
      if (arrived) {
        this.searchTimer -= dt;
        if (this.searchTimer <= 0 || this.path.length === 0) {
          this.searchTimer -= dt;
          if (this.searchTimer < -2) this._setState(STATE.PATROL);
        }
      }
    } else if (this.state === STATE.SEARCH) {
      this.searchTimer -= dt;
      if (this.repathTimer <= 0 && this.lastKnownPlayerCell) {
        this.repathTimer = 1.2;
        this.path = bfsPath(grid, myCell, this.lastKnownPlayerCell, { excludeVents: true }) || [];
      }
      this._followPath(dt, SPEEDS.SEARCH);
      if (this.searchTimer <= 0) this._setState(STATE.PATROL);
    } else {
      // PATROL
      if (!this.path.length && this.waitTimer <= 0) {
        const target = PATROL_ROUTE[this.patrolIndex];
        this.path = bfsPath(grid, myCell, target, { excludeVents: true }) || [];
        if (!this.path.length) {
          this.patrolIndex = (this.patrolIndex + 1) % PATROL_ROUTE.length;
        }
      }
      if (this.waitTimer > 0) {
        this.waitTimer -= dt;
      } else {
        const arrived = this._followPath(dt, SPEEDS.PATROL);
        if (arrived) {
          this.patrolIndex = (this.patrolIndex + 1) % PATROL_ROUTE.length;
          this.waitTimer = 0.6 + Math.random() * 1.4;
        }
      }
    }

    this._updateVisual(dt);
  }

  _updateVisual(dt) {
    this.group.position.set(this.position.x, 0, this.position.z);
    const angle = Math.atan2(this.facing.x, this.facing.z);
    this.group.rotation.y = angle;

    const moving = this.state !== STATE.PATROL || this.waitTimer <= 0;
    const swingSpeed = this.state === STATE.CHASE ? 14 : 8;
    const swing = moving ? Math.sin(this.animTime * swingSpeed) * 0.5 : 0;
    this.armL.rotation.x = swing;
    this.armR.rotation.x = -swing;
    this.legL.rotation.x = -swing * 0.7;
    this.legR.rotation.x = swing * 0.7;
    this.torso.position.y = 1.15 + Math.abs(Math.sin(this.animTime * swingSpeed)) * 0.02;

    const isChasing = this.state === STATE.CHASE;
    this.eyeLight.intensity = isChasing ? 1.6 : this.state === STATE.INVESTIGATE ? 0.6 : 0.15;
  }

  distanceTo(player) {
    return this.position.distanceTo(player.camera.position);
  }
}

export { STATE as StalkerState };
