import * as THREE from "three";
import { Level } from "../world/Level.js";
import { ROOMS, cellCenterWorld } from "../world/levelLayout.js";
import { PlayerController } from "../player/PlayerController.js";
import { Stalker } from "../enemy/Stalker.js";
import { SanitySystem } from "../player/Sanity.js";
import { AudioManager } from "../audio/AudioManager.js";
import { UIManager } from "../ui/UIManager.js";
import { loadSettings, saveSettings } from "./Settings.js";

const STATE = {
  MENU: "MENU",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  DEAD: "DEAD",
  WON: "WON",
};

const MENU_CAM_CENTER = (() => {
  const c = cellCenterWorld((ROOMS.entrance.x0 + ROOMS.entrance.x1) / 2, (ROOMS.entrance.z0 + ROOMS.entrance.z1) / 2);
  return c;
})();

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.settings = loadSettings();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.1, 120);

    this.ui = new UIManager(uiRoot, this.settings);
    this.audio = new AudioManager(this.settings);

    this.state = STATE.MENU;
    this._settingsOpen = false;
    this._settingsReturn = "menu";
    this._noteOpen = false;
    this._noteTimer = null;
    this.clock = new THREE.Clock();

    this._buildWorld();
    this._bindUI();
    window.addEventListener("resize", () => this._onResize());

    this.ui.showMenu();
    this._renderStaticFrame();
    this._loop();
  }

  _buildWorld() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030303);
    this.scene.fog = new THREE.FogExp2(0x020202, 0.032);

    this.level = new Level();
    this.scene.add(this.level.group);

    const ambient = new THREE.AmbientLight(0x2a2a36, 0.4);
    this.scene.add(ambient);

    this.scene.add(this.camera);

    this.player = new PlayerController(this.camera, this.canvas, this.level, this.settings);
    this.player.onFootstep = ({ sprinting, noiseRadius }) => {
      this.audio.footstep(sprinting);
      if (this.stalker) {
        this.stalker.registerNoise(this.player.position.clone(), noiseRadius);
      }
    };
    this.player.onFlashlightToggle = () => this.audio.uiBlip();
    this.player.onLockChange = (locked) => this._onLockChange(locked);

    this.stalker = new Stalker(this.level);
    this.scene.add(this.stalker.group);

    this.sanity = new SanitySystem();
    this.sanity.onWhisper = (dread) => this.audio.whisper(dread);
    this.sanity.onHallucination = () => this._triggerHallucination();

    this.fuseCount = 0;
    this.panelPowered = false;
    this._wasChasing = false;
  }

  _bindUI() {
    this.ui.startButton.addEventListener("click", () => this._startGame());
    this.ui.resumeButton.addEventListener("click", () => this._resumeFromPause());
    this.ui.retryDeathButton.addEventListener("click", () => this._restart());
    this.ui.retryWinButton.addEventListener("click", () => this._restart());
    this.ui.pauseRestartButton.addEventListener("click", () => this._restart());
    this.ui.pauseQuitButton.addEventListener("click", () => this._quitToMenu());

    this.ui.menuSettingsButton.addEventListener("click", () => this._openSettings("menu"));
    this.ui.pauseSettingsButton.addEventListener("click", () => this._openSettings("pause"));
    this.ui.settingsBackButton.addEventListener("click", () => this._closeSettings());

    this.ui.sensitivitySlider.addEventListener("input", (e) => {
      this.settings.mouseSensitivity = Number(e.target.value);
      saveSettings(this.settings);
    });
    this.ui.fovSlider.addEventListener("input", (e) => {
      this.settings.fov = Number(e.target.value);
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
      saveSettings(this.settings);
    });
    this.ui.invertYCheckbox.addEventListener("change", (e) => {
      this.settings.invertY = e.target.checked;
      saveSettings(this.settings);
    });
    this.ui.masterVolumeSlider.addEventListener("input", (e) => {
      this.settings.masterVolume = Number(e.target.value);
      this.audio.setMasterVolume(this.settings.masterVolume);
      saveSettings(this.settings);
    });
    this.ui.musicVolumeSlider.addEventListener("input", (e) => {
      this.settings.musicVolume = Number(e.target.value);
      this.audio.setMusicVolume(this.settings.musicVolume);
      saveSettings(this.settings);
    });
    this.ui.sfxVolumeSlider.addEventListener("input", (e) => {
      this.settings.sfxVolume = Number(e.target.value);
      this.audio.setSfxVolume(this.settings.sfxVolume);
      saveSettings(this.settings);
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        if (this._noteOpen) {
          this._closeNote();
          return;
        }
        if (this._settingsOpen) {
          this._closeSettings();
          return;
        }
        if (this.state === STATE.PLAYING) this._pause();
        return;
      }
      if (e.code === "KeyE" && this.state === STATE.PLAYING) {
        if (this._noteOpen) {
          this._closeNote();
        } else {
          this._tryInteract();
        }
      }
    });
  }

  _openSettings(from) {
    this._settingsReturn = from;
    this._settingsOpen = true;
    if (from === "pause") this.ui.hidePause();
    else this.ui.hideMenu();
    this.ui.showSettings();
  }

  _closeSettings() {
    this._settingsOpen = false;
    this.ui.hideSettings();
    if (this._settingsReturn === "pause") this.ui.showPause();
    else this.ui.showMenu();
  }

  _startGame() {
    this.audio.start();
    this.audio.resume();
    this.ui.hideMenu();
    this.ui.showHud();
    this.ui.setObjective("Finde 3 Sicherungen (0/3)");
    this.state = STATE.PLAYING;
    this.clock.getDelta();
    this.player.lock();
  }

  _onLockChange(locked) {
    if (!locked && this.state === STATE.PLAYING) {
      this._pause();
    }
  }

  _pause() {
    this.state = STATE.PAUSED;
    this.player.unlock();
    this.ui.showPause();
  }

  _resumeFromPause() {
    this.ui.hidePause();
    this.audio.resume();
    this.state = STATE.PLAYING;
    this.clock.getDelta();
    this.player.lock();
  }

  _interactionCandidates() {
    return [...this.level.fuses, ...this.level.notes, ...this.level.batteries, this.level.panelMesh, this.level.exitDoorMesh];
  }

  _tryInteract() {
    const target = this.player.findInteractable(this._interactionCandidates());
    if (!target) return;

    if (target.userData.kind === "fuse" && !target.userData.collected) {
      target.userData.collected = true;
      target.visible = false;
      this.fuseCount++;
      this.audio.pickupChime();
      this.ui.setFuseCount(this.fuseCount);
      if (this.fuseCount >= 3) {
        this.ui.setObjective("Aktiviere den Generator im Maschinenraum");
      } else {
        this.ui.setObjective(`Finde 3 Sicherungen (${this.fuseCount}/3)`);
      }
      return;
    }

    if (target.userData.kind === "battery" && !target.userData.collected) {
      target.userData.collected = true;
      target.visible = false;
      this.player.battery = 1;
      this.audio.pickupChime();
      return;
    }

    if (target.userData.kind === "note" && !target.userData.collected) {
      target.userData.collected = true;
      target.visible = false;
      this.audio.uiBlip();
      this._openNote(target.userData.title, target.userData.text);
      return;
    }

    if (target.userData.kind === "panel" && !this.panelPowered && this.fuseCount >= 3) {
      this.panelPowered = true;
      this.level.setPanelPowered(true);
      this.audio.panelPower();
      this.ui.setObjective("Erreiche den Ausgang");
      return;
    }

    if (target.userData.kind === "exit" && this.panelPowered) {
      this._win();
    }
  }

  _openNote(title, text) {
    this._noteOpen = true;
    this.ui.showNote(title, text);
    if (this._noteTimer) clearTimeout(this._noteTimer);
    this._noteTimer = setTimeout(() => this._closeNote(), 9000);
  }

  _closeNote() {
    this._noteOpen = false;
    this.ui.hideNote();
    if (this._noteTimer) {
      clearTimeout(this._noteTimer);
      this._noteTimer = null;
    }
  }

  _updatePromptAndObjective() {
    const target = this.player.findInteractable(this._interactionCandidates());
    if (!target) {
      this.ui.setPrompt(null);
      return;
    }
    if (target.userData.kind === "fuse") {
      this.ui.setPrompt("[E] Sicherung aufnehmen");
    } else if (target.userData.kind === "battery") {
      this.ui.setPrompt("[E] Batterie aufnehmen");
    } else if (target.userData.kind === "note") {
      this.ui.setPrompt("[E] Notiz lesen");
    } else if (target.userData.kind === "panel") {
      if (this.panelPowered) {
        this.ui.setPrompt("Generator aktiv");
      } else if (this.fuseCount >= 3) {
        this.ui.setPrompt("[E] Generator aktivieren");
      } else {
        this.ui.setPrompt(`Benötigt Sicherungen (${this.fuseCount}/3)`);
      }
    } else if (target.userData.kind === "exit") {
      this.ui.setPrompt(this.panelPowered ? "[E] Station verlassen" : "Tür ist verriegelt");
    }
  }

  _triggerHallucination() {
    this.audio.whisper(1);
    this.ui.setDread(1);
    setTimeout(() => {
      if (this.state === STATE.PLAYING) this.ui.setDread(1 - this.sanity.value / 100);
    }, 260);
  }

  _die() {
    this.state = STATE.DEAD;
    this._closeNote();
    this.audio.jumpscare();
    this.ui.flashJumpscare();
    this.player.unlock();
    setTimeout(() => this.ui.showDeath(), 220);
  }

  _win() {
    this.state = STATE.WON;
    this._closeNote();
    this.player.unlock();
    this.ui.showWin();
  }

  _resetWorldAndUi() {
    this._closeNote();
    this.ui.hideDeath();
    this.ui.hideWin();
    this.ui.hidePause();
    this.scene.remove(this.level.group);
    this.scene.remove(this.stalker.group);
    this.player.dispose();

    this._buildWorld();
    this.ui.setFuseCount(0);
    this.ui.setSanity(100);
    this.ui.setObjective("Finde 3 Sicherungen (0/3)");
    this.ui.setDread(0);
  }

  _restart() {
    this._resetWorldAndUi();
    this._startGame();
  }

  _quitToMenu() {
    this._resetWorldAndUi();
    this.ui.hideHud();
    this.state = STATE.MENU;
    this.ui.showMenu();
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  _renderStaticFrame() {
    this._onResize();
    this._updateMenuCamera(0);
    this.renderer.render(this.scene, this.camera);
  }

  _updateMenuCamera(t) {
    const angle = t * 0.06;
    const radius = 5.5;
    this.camera.position.set(
      MENU_CAM_CENTER.x + Math.cos(angle) * radius,
      1.7,
      MENU_CAM_CENTER.z + Math.sin(angle) * radius
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(MENU_CAM_CENTER.x, 1.55, MENU_CAM_CENTER.z);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.level.updateFlicker(t);

    if (this.state === STATE.MENU) {
      this._updateMenuCamera(t);
    }

    if (this.state === STATE.PLAYING) {
      this.player.update(dt);
      this.stalker.update(dt, this.player);
      this.level.updateDoors(dt, this.player.position, () => this.audio.doorCreak());
      this._updatePromptAndObjective();

      const enemyDist = this.stalker.distanceTo(this.player);
      const isChasing = this.stalker.state === "CHASE";
      if (isChasing && !this._wasChasing) this.audio.chaseStinger();
      this._wasChasing = isChasing;

      const sanityResult = this.sanity.update(dt, {
        inSafeZone: this.level.isInSafeZone(this.player.position.x, this.player.position.z),
        flashlightOn: this.player.flashlightOn,
        enemyDistance: enemyDist,
        enemyChasing: isChasing,
      });
      this.ui.setSanity(sanityResult.value);
      this.ui.setVignette(sanityResult.vignetteStrength);
      this.ui.setDread(sanityResult.distortion);
      this.ui.setBattery(this.player.battery);

      const danger = isChasing ? 1 : Math.max(0, 1 - enemyDist / 9);
      this.audio.update(dt, danger);

      if (this.stalker.caughtPlayer) {
        this._die();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
