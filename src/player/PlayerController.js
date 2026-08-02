import * as THREE from "three";
import { DEFAULT_KEYBINDINGS, DIFFICULTY_PRESETS } from "../core/Settings.js";

const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.6;
const CROUCH_SPEED = 1.6;
const PLAYER_RADIUS = 0.32;
const EYE_HEIGHT_STAND = 1.62;
const EYE_HEIGHT_CROUCH = 1.0;
const FLASHLIGHT_DRAIN_PER_SEC = 0.045;
const FLASHLIGHT_RECHARGE_PER_SEC = 0.02;
const STAMINA_DRAIN_PER_SEC = 0.3;
const STAMINA_REGEN_PER_SEC = 0.16;
const STAMINA_MIN_TO_SPRINT = 0.06;

export class PlayerController {
  constructor(camera, domElement, level, settings) {
    this.camera = camera;
    this.domElement = domElement;
    this.level = level;
    this.settings = settings;

    this.yaw = 0;
    this.pitch = 0;
    this.position = level.spawnWorldPos();
    this.velocity = new THREE.Vector3();

    this.keys = new Set();
    this.locked = false;
    this.crouching = false;
    this.sprinting = false;
    this.moving = false;

    this.battery = 1;
    this.flashlightOn = false;
    this.stamina = 1;

    this._footstepTimer = 0;
    this._bobTime = 0;
    this.onFootstep = null;
    this.onFlashlightToggle = null;

    this.flashlight = new THREE.SpotLight(0xfff3d6, 0, 0, Math.PI / 7, 0.45, 1.4);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlight.target = this.flashlightTarget;
    camera.add(this.flashlight);
    camera.add(this.flashlightTarget);
    this.flashlight.position.set(0, 0, 0);
    this.flashlightTarget.position.set(0, 0, -1);

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
  }

  _kb() {
    return this.settings?.keybindings || DEFAULT_KEYBINDINGS;
  }

  _difficulty() {
    return DIFFICULTY_PRESETS[this.settings?.difficulty] || DIFFICULTY_PRESETS.normal;
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    if (document.pointerLockElement === this.domElement) document.exitPointerLock();
  }

  _onPointerLockChange() {
    this.locked = document.pointerLockElement === this.domElement;
    if (this.locked) {
      document.addEventListener("mousemove", this._onMouseMove);
    } else {
      document.removeEventListener("mousemove", this._onMouseMove);
      this.keys.clear();
    }
    if (this.onLockChange) this.onLockChange(this.locked);
  }

  _onMouseMove(e) {
    const sensitivity = 0.0022 * (this.settings?.mouseSensitivity ?? 1);
    const invert = this.settings?.invertY ? -1 : 1;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity * invert;
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  _onKeyDown(e) {
    if (!this.locked) return;
    this.keys.add(e.code);
    const kb = this._kb();
    if (e.code === kb.flashlight) this.toggleFlashlight();
    if (e.code === kb.crouch) this.crouching = !this.crouching;
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  toggleFlashlight(force) {
    const next = force !== undefined ? force : !this.flashlightOn;
    if (next && this.battery <= 0.02) return;
    this.flashlightOn = next;
    if (this.onFlashlightToggle) this.onFlashlightToggle(this.flashlightOn);
  }

  getForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  _tryMove(dx, dz) {
    const p = this.position;
    const r = PLAYER_RADIUS;
    // Move on X, check collision with a small radius sample.
    const nx = p.x + dx;
    if (
      !this.level.isWallAtWorld(nx + Math.sign(dx) * r, p.z) &&
      !this.level.isWallAtWorld(nx + Math.sign(dx) * r, p.z + r * 0.6) &&
      !this.level.isWallAtWorld(nx + Math.sign(dx) * r, p.z - r * 0.6)
    ) {
      p.x = nx;
    }
    const nz = p.z + dz;
    if (
      !this.level.isWallAtWorld(p.x, nz + Math.sign(dz) * r) &&
      !this.level.isWallAtWorld(p.x + r * 0.6, nz + Math.sign(dz) * r) &&
      !this.level.isWallAtWorld(p.x - r * 0.6, nz + Math.sign(dz) * r)
    ) {
      p.z = nz;
    }
  }

  update(dt) {
    const forward = this.getForward();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const kb = this._kb();

    let ix = 0;
    let iz = 0;
    if (this.keys.has(kb.forward) || this.keys.has("ArrowUp")) iz += 1;
    if (this.keys.has(kb.back) || this.keys.has("ArrowDown")) iz -= 1;
    if (this.keys.has(kb.right) || this.keys.has("ArrowRight")) ix += 1;
    if (this.keys.has(kb.left) || this.keys.has("ArrowLeft")) ix -= 1;

    this.moving = ix !== 0 || iz !== 0;
    const wantsSprint = this.moving && this.keys.has(kb.sprint) && !this.crouching;
    this.sprinting = wantsSprint && this.stamina > STAMINA_MIN_TO_SPRINT;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_PER_SEC * dt);
    } else {
      this.stamina = Math.min(1, this.stamina + STAMINA_REGEN_PER_SEC * dt);
    }

    let speed = this.crouching ? CROUCH_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED;

    let move = new THREE.Vector3();
    if (this.moving) {
      move.addScaledVector(forward, iz);
      move.addScaledVector(right, ix);
      move.normalize().multiplyScalar(speed * dt);
    }

    if (this.locked) {
      this._tryMove(move.x, move.z);
    }

    // Flashlight battery
    const batteryDrainMult = this._difficulty().batteryDrain;
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - FLASHLIGHT_DRAIN_PER_SEC * batteryDrainMult * dt);
      if (this.battery <= 0) this.toggleFlashlight(false);
    } else {
      this.battery = Math.min(1, this.battery + FLASHLIGHT_RECHARGE_PER_SEC * dt);
    }
    this.flashlight.intensity = this.flashlightOn ? 140 : 0;

    // Head bob + footsteps
    const targetEye = this.crouching ? EYE_HEIGHT_CROUCH : EYE_HEIGHT_STAND;
    this._eyeHeight = THREE.MathUtils.lerp(this._eyeHeight ?? targetEye, targetEye, 1 - Math.pow(0.001, dt));

    let bobY = 0;
    if (this.moving && this.locked) {
      this._bobTime += dt * (this.sprinting ? 11 : this.crouching ? 6 : 8);
      bobY = Math.sin(this._bobTime) * (this.sprinting ? 0.045 : 0.03);

      const stepInterval = this.sprinting ? 0.32 : this.crouching ? 0.55 : 0.45;
      this._footstepTimer += dt;
      if (this._footstepTimer >= stepInterval) {
        this._footstepTimer = 0;
        if (this.onFootstep) {
          this.onFootstep({
            sprinting: this.sprinting,
            crouching: this.crouching,
            noiseRadius: this.crouching ? 3 : this.sprinting ? 15 : 8,
          });
        }
      }
    } else {
      this._footstepTimer = 0;
    }

    this.camera.position.set(this.position.x, this._eyeHeight + bobY, this.position.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  findInteractable(candidates, maxDist = 2.4) {
    const camPos = this.camera.position;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    let best = null;
    let bestDot = 0.6;
    for (const obj of candidates) {
      if (!obj || obj.userData?.collected) continue;
      const objPos = new THREE.Vector3();
      obj.getWorldPosition(objPos);
      const toObj = objPos.clone().sub(camPos);
      const dist = toObj.length();
      if (dist > maxDist) continue;
      toObj.normalize();
      const dot = toObj.dot(forward);
      if (dot > bestDot) {
        bestDot = dot;
        best = obj;
      }
    }
    return best;
  }

  dispose() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
    this.camera.remove(this.flashlight);
    this.camera.remove(this.flashlightTarget);
  }
}
