import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader.js";
import { Level } from "../world/Level.js";
import { ROOMS, cellCenterWorld } from "../world/levelLayout.js";
import { PlayerController } from "../player/PlayerController.js";
import { Stalker } from "../enemy/Stalker.js";
import { VentDweller } from "../enemy/VentDweller.js";
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

// Vent kick-out points: wherever the player is caught lingering by the
// vent dweller, they're shoved back out the nearer end of the shortcut.
const VENT_EXIT_A = (() => {
  const c = cellCenterWorld(8, 4);
  return new THREE.Vector3(c.x, 0, c.z);
})();
const VENT_EXIT_B = (() => {
  const c = cellCenterWorld(24, 18);
  return new THREE.Vector3(c.x, 0, c.z);
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

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.1, 140);

    this.ui = new UIManager(uiRoot, this.settings);
    this.audio = new AudioManager(this.settings);

    this.state = STATE.MENU;
    this._settingsOpen = false;
    this._settingsReturn = "menu";
    this._journalOpen = false;
    this._noteOpen = false;
    this._noteTimer = null;
    this._seenHints = new Set();
    this._ppAberration = 0;
    this._ppGrain = 0.08;
    this.clock = new THREE.Clock();

    this._buildWorld();
    this._setupPostProcessing();
    this._bindUI();
    this._checkCompatibility();
    window.addEventListener("resize", () => this._onResize());

    this.ui.showMenu();
    this._renderStaticFrame();
    this._loop();
  }

  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.rgbShiftPass = new ShaderPass(RGBShiftShader);
    this.rgbShiftPass.uniforms.amount.value = 0;
    this.composer.addPass(this.rgbShiftPass);

    this.filmPass = new FilmPass(0.08, false);
    this.composer.addPass(this.filmPass);

    this.composer.addPass(new OutputPass());
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  _checkCompatibility() {
    const hasPointerLock = !!this.canvas.requestPointerLock;
    const finePointer = !window.matchMedia || window.matchMedia("(pointer: fine)").matches;
    if (!hasPointerLock || !finePointer) {
      this.ui.setCompatWarning(
        "Dieses Spiel braucht Maus und Tastatur (Pointer-Lock-API). Auf Touch-Geräten oder ohne Maus lässt es sich nicht zuverlässig steuern."
      );
    }
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

    if (this.renderPass) this.renderPass.scene = this.scene;

    this.player = new PlayerController(this.camera, this.canvas, this.level, this.settings);
    this.player.onFootstep = ({ sprinting, noiseRadius }) => {
      this.audio.footstep(sprinting);
      if (this.stalker) {
        this.stalker.registerNoise(this.player.position.clone(), noiseRadius);
      }
    };
    this.player.onFlashlightToggle = () => this.audio.uiBlip();
    this.player.onLockChange = (locked) => this._onLockChange(locked);

    this.stalker = new Stalker(this.level, this.settings);
    this.scene.add(this.stalker.group);

    this.ventDweller = new VentDweller();
    this.ventDweller.onWarningPulse = (danger) => {
      this.audio.ventScratch(danger);
      this._caption("[Kratzen im Schacht]");
    };
    this.ventDweller.onTrigger = () => this._ventAmbush();

    this.sanity = new SanitySystem(this.settings);
    this.sanity.onWhisper = (dread) => {
      this.audio.whisper(dread);
      this._caption("[Flüstern in der Dunkelheit]");
    };
    this.sanity.onHallucination = () => this._triggerHallucination();

    this.fuseCount = 0;
    this.panelPowered = false;
    this._coreExitAnnounced = false;
    this._wasChasing = false;
    this.checkpointPos = this.level.spawnWorldPos().clone();
  }

  _bindUI() {
    this.ui.startButton.addEventListener("click", () => this._startGame());
    this.ui.resumeButton.addEventListener("click", () => this._resumeFromPause());
    this.ui.retryDeathButton.addEventListener("click", () => this._respawnAtCheckpoint());
    this.ui.retryWinButton.addEventListener("click", () => this._restart());
    this.ui.pauseRestartButton.addEventListener("click", () => this._restart());
    this.ui.pauseQuitButton.addEventListener("click", () => this._quitToMenu());

    this.ui.menuSettingsButton.addEventListener("click", () => this._openSettings("menu"));
    this.ui.pauseSettingsButton.addEventListener("click", () => this._openSettings("pause"));
    this.ui.settingsBackButton.addEventListener("click", () => this._closeSettings());

    this.ui.pauseJournalButton.addEventListener("click", () => this._openJournal());
    this.ui.journalBackButton.addEventListener("click", () => this._closeJournal());

    this.ui.fullscreenButton.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });

    for (const [key, btn] of Object.entries(this.ui.difficultyButtons)) {
      btn.addEventListener("click", () => {
        this.settings.difficulty = key;
        this.ui.setDifficultyActive(key);
        saveSettings(this.settings);
      });
    }

    for (const action of Object.keys(this.ui.keybindButtons)) {
      this.ui.keybindButtons[action].addEventListener("click", () => this._startRebind(action));
    }

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
    this.ui.subtitlesCheckbox.addEventListener("change", (e) => {
      this.settings.subtitles = e.target.checked;
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
        if (this._journalOpen) {
          this._closeJournal();
          return;
        }
        if (this._settingsOpen) {
          this._closeSettings();
          return;
        }
        if (this.state === STATE.PLAYING) this._pause();
        return;
      }
      const interactKey = this.settings.keybindings.interact;
      if (e.code === interactKey && this.state === STATE.PLAYING) {
        if (this._noteOpen) {
          this._closeNote();
        } else {
          this._tryInteract();
        }
      }
    });
  }

  _startRebind(action) {
    this.ui.setKeybindListening(action);
    const handler = (e) => {
      e.preventDefault();
      document.removeEventListener("keydown", handler, true);
      if (e.code !== "Escape") {
        this.settings.keybindings[action] = e.code;
        saveSettings(this.settings);
      }
      this.ui.setKeybindLabel(action, this.settings.keybindings[action]);
    };
    document.addEventListener("keydown", handler, true);
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

  _openJournal() {
    this._journalOpen = true;
    this.ui.hidePause();
    const entries = this.level.notes
      .filter((n) => n.userData.collected)
      .map((n) => ({ title: n.userData.title, text: n.userData.text }));
    this.ui.setJournalEntries(entries);
    this.ui.showJournal();
  }

  _closeJournal() {
    this._journalOpen = false;
    this.ui.hideJournal();
    this.ui.showPause();
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
    return [
      ...this.level.fuses,
      ...this.level.notes,
      ...this.level.batteries,
      this.level.panelMesh,
      this.level.exitDoorMesh,
      this.level.finalExitMesh,
    ];
  }

  _hint(id, text) {
    if (this._seenHints.has(id)) return;
    this._seenHints.add(id);
    this.ui.showHint(text);
  }

  _caption(text) {
    if (this.settings.subtitles) this.ui.showCaption(text);
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
      this.checkpointPos = target.getWorldPosition(new THREE.Vector3());
      this._hint("fuse", "Bring alle drei Sicherungen zum Generator im Maschinenraum.");
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
      this.checkpointPos = target.getWorldPosition(new THREE.Vector3());
      this.ui.setObjective("Erreiche den Ausgang");
      return;
    }

    if (target.userData.kind === "exit" && this.panelPowered) {
      if (!this._coreExitAnnounced) {
        this._coreExitAnnounced = true;
        this.audio.uiBlip();
        this.ui.setObjective("Steige durch den Schacht zur Oberfläche auf");
      }
      return;
    }

    if (target.userData.kind === "finalExit" && this.panelPowered) {
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
      this.ui.setPrompt(this.panelPowered ? "[E] Kernbereich verlassen" : "Tür ist verriegelt");
    } else if (target.userData.kind === "finalExit") {
      this.ui.setPrompt(this.panelPowered ? "[E] Zur Oberfläche" : "Der Generator muss laufen");
    }
  }

  _triggerHallucination() {
    this.audio.whisper(1);
    this._caption("[Etwas bewegt sich am Rand deines Blicks]");
    this.ui.setDread(1);
    setTimeout(() => {
      if (this.state === STATE.PLAYING) this.ui.setDread(1 - this.sanity.value / 100);
    }, 260);
  }

  _ventAmbush() {
    this.audio.jumpscare();
    this.ui.flashJumpscare();
    this._caption("[Es hat dich fast erwischt]");
    this.sanity.value = Math.max(0, this.sanity.value - 35);
    const p = this.player.position;
    const target = p.distanceTo(VENT_EXIT_A) < p.distanceTo(VENT_EXIT_B) ? VENT_EXIT_A : VENT_EXIT_B;
    p.x = target.x;
    p.z = target.z;
    this.ventDweller.reset();
  }

  _composeEnding() {
    const totalNotes = this.level.notes.length;
    const notesCollected = this.level.notes.filter((n) => n.userData.collected).length;
    const sanity = this.sanity.value;

    if (notesCollected >= totalNotes) {
      return {
        title: "ENTKOMMEN - MIT ANTWORTEN",
        text: "Du erreichst die Oberfläche - diesmal mit mehr als nur deinem Leben. Die Notizen aus Kreide-9 zeichnen ein Bild, das die Zentrale nicht hören will: was dort unten lebt, war schon vor der Station da. Du meldest alles. Ob es jemanden interessiert, ist eine andere Frage.",
      };
    }
    if (sanity < 30) {
      return {
        title: "ENTKOMMEN",
        text: "Du erreichst die Oberfläche, aber etwas in dir ist unten geblieben. Deine Hände zittern noch Stunden später. Was auch immer in Kreide-9 lebt - es bleibt dort unten. Vorerst. Du bist dir da nicht mehr so sicher wie früher.",
      };
    }
    return {
      title: "ENTKOMMEN",
      text: "Du erreichst die Oberfläche. Hinter dir fällt die Luke ins Schloss. Was auch immer in Kreide-9 lebt - es bleibt dort unten. Vorerst.",
    };
  }

  _die() {
    this.state = STATE.DEAD;
    this._closeNote();
    this.audio.jumpscare();
    this.ui.flashJumpscare();
    this.player.unlock();

    // A brief, frozen close-up on whatever just caught you before cutting
    // to the death screen.
    const headWorld = new THREE.Vector3();
    this.stalker.head.getWorldPosition(headWorld);
    const lookDir = headWorld.clone().sub(this.camera.position).normalize();
    this.camera.position.copy(headWorld).addScaledVector(lookDir, -0.55);
    this.camera.lookAt(headWorld);

    setTimeout(() => this.ui.showDeath(), 550);
  }

  _win() {
    this.state = STATE.WON;
    this._closeNote();
    this.player.unlock();
    const { title, text } = this._composeEnding();
    this.ui.showWin(title, text);
  }

  _respawnAtCheckpoint() {
    this.ui.hideDeath();
    this._closeNote();
    this.player.position.copy(this.checkpointPos);
    this.player.battery = 1;
    this.player.stamina = 1;
    this.sanity.value = 55;
    this.ui.setDread(0);

    this.scene.remove(this.stalker.group);
    this.stalker = new Stalker(this.level, this.settings);
    this.scene.add(this.stalker.group);
    this._wasChasing = false;
    this.ventDweller.reset();

    this.state = STATE.PLAYING;
    this.clock.getDelta();
    this.player.lock();
  }

  _resetWorldAndUi() {
    this._closeNote();
    this.ui.hideDeath();
    this.ui.hideWin();
    this.ui.hidePause();
    this.ui.hideJournal();
    this.scene.remove(this.level.group);
    this.scene.remove(this.stalker.group);
    this.player.dispose();

    this._buildWorld();
    this.ui.setFuseCount(0);
    this.ui.setSanity(100);
    this.ui.setStamina(1);
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
    if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
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

      const inVent = this.level.isVentAtWorld(this.player.position.x, this.player.position.z);
      if (inVent) this._hint("vent", "Hier drin bist du vor ihr sicher - aber halte dich nicht zu lange auf.");
      this.ventDweller.update(dt, inVent);

      const enemyDist = this.stalker.distanceTo(this.player);
      const isChasing = this.stalker.state === "CHASE";
      if (isChasing && !this._wasChasing) {
        this.audio.chaseStinger();
        this._caption("[Sie hat dich bemerkt]");
        this._hint(
          "chase",
          "Sie hat dich bemerkt! Lauf, versteck dich oder flieh in die Lüftungsschächte - dort kann sie dir nicht folgen."
        );
      } else if (!isChasing && this._wasChasing) {
        this._caption("[Verloren... vorerst]");
      }
      this._wasChasing = isChasing;

      const sanityResult = this.sanity.update(dt, {
        inSafeZone: this.level.isInSafeZone(this.player.position.x, this.player.position.z),
        flashlightOn: this.player.flashlightOn,
        enemyDistance: enemyDist,
        enemyChasing: isChasing,
      });
      this.ui.setSanity(sanityResult.value);
      this.ui.setStamina(this.player.stamina);
      this.ui.setVignette(sanityResult.vignetteStrength);
      this.ui.setDread(sanityResult.distortion);
      this.ui.setBattery(this.player.battery);
      if (sanityResult.value < 40) {
        this._hint("sanity", "Deine Nerven liegen blank. Licht und ruhige Orte helfen dir, dich zu beruhigen.");
      }

      this._ppAberration = sanityResult.distortion * 0.006;
      this._ppGrain = 0.08 + sanityResult.distortion * 0.45;

      const danger = isChasing ? 1 : Math.max(0, 1 - enemyDist / 9);
      this.audio.update(dt, danger);

      if (this.stalker.caughtPlayer) {
        this._die();
      }
    } else {
      this._ppAberration = 0;
      this._ppGrain = 0.08;
    }

    if (this.rgbShiftPass) this.rgbShiftPass.uniforms.amount.value = this._ppAberration;
    if (this.filmPass) this.filmPass.uniforms.intensity.value = this._ppGrain;

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
