const STORAGE_KEY = "hollow-station-settings-v1";

export const DEFAULT_SETTINGS = {
  mouseSensitivity: 1,
  invertY: false,
  fov: 72,
  masterVolume: 0.85,
  musicVolume: 0.7,
  sfxVolume: 1,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage disabled (e.g. private browsing) - settings just won't persist.
  }
}
