const STORAGE_KEY = "hollow-station-settings-v1";

export const DEFAULT_KEYBINDINGS = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "ShiftLeft",
  crouch: "KeyC",
  flashlight: "KeyF",
  interact: "KeyE",
};

export const DIFFICULTY_PRESETS = {
  easy: { label: "Leicht", enemySpeed: 0.82, enemyVision: 0.85, sanityDrain: 0.65, batteryDrain: 0.7 },
  normal: { label: "Normal", enemySpeed: 1, enemyVision: 1, sanityDrain: 1, batteryDrain: 1 },
  hard: { label: "Schwer", enemySpeed: 1.2, enemyVision: 1.15, sanityDrain: 1.4, batteryDrain: 1.3 },
};

export const DEFAULT_SETTINGS = {
  mouseSensitivity: 1,
  invertY: false,
  fov: 72,
  masterVolume: 0.85,
  musicVolume: 0.7,
  sfxVolume: 1,
  difficulty: "normal",
  subtitles: false,
  keybindings: { ...DEFAULT_KEYBINDINGS },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      keybindings: { ...DEFAULT_KEYBINDINGS, ...(parsed.keybindings || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage disabled (e.g. private browsing) - settings just won't persist.
  }
}
