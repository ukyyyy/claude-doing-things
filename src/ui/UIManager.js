const STORY_TEXT = `Forschungsstation "KREIDE-9", 340 Meter unter der Oberfläche.
Der Funkkontakt brach vor sechs Stunden ab. Finde drei Sicherungen, aktiviere
den Generator im Maschinenraum und verlasse die Station - bevor sie dich findet.`;

export class UIManager {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this._buildMenu();
    this._buildHud();
    this._buildPause();
    this._buildSettings();
    this._buildNoteOverlay();
    this._buildEndScreens();
  }

  _el(tag, className, parent) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (parent) parent.appendChild(e);
    return e;
  }

  _buildMenu() {
    const overlay = this._el("div", "hs-overlay hs-overlay-menu", this.root);
    this._el("h1", "hs-title", overlay).textContent = "HOLLOW STATION";
    this._el("p", "hs-sub", overlay).textContent = STORY_TEXT;

    const controls = this._el("div", "hs-controls", overlay);
    const rows = [
      ["WASD", "Bewegen"],
      ["Shift", "Sprinten (laut!)"],
      ["C", "Ducken (leise, langsamer)"],
      ["F", "Taschenlampe"],
      ["E", "Interagieren"],
      ["Maus", "Umsehen"],
      ["Esc", "Pause"],
    ];
    for (const [k, v] of rows) {
      this._el("span", null, controls).textContent = k;
      this._el("span", null, controls).textContent = v;
    }

    const btnRow = this._el("div", "hs-btn-row", overlay);
    const btn = this._el("button", "hs-btn", btnRow);
    btn.textContent = "Station betreten";
    this.startButton = btn;

    const settingsBtn = this._el("button", "hs-btn hs-btn-secondary", btnRow);
    settingsBtn.textContent = "Einstellungen";
    this.menuSettingsButton = settingsBtn;

    this.menuOverlay = overlay;
  }

  _buildHud() {
    const hud = this._el("div", null, this.root);
    hud.id = "hud";
    hud.className = "hs-hidden";
    this.hud = hud;

    this._el("div", null, hud).id = "crosshair";

    const objective = this._el("div", null, hud);
    objective.id = "objective";
    this.objectiveEl = objective;

    const prompt = this._el("div", null, hud);
    prompt.id = "prompt";
    prompt.style.display = "none";
    this.promptEl = prompt;

    const fuses = this._el("div", null, hud);
    fuses.id = "fuses";
    this.fusePips = [];
    for (let i = 0; i < 3; i++) {
      const pip = this._el("div", "fuse-pip", fuses);
      this.fusePips.push(pip);
    }

    const sanityBar = this._el("div", null, hud);
    sanityBar.id = "sanity-bar";
    const sanityFill = this._el("div", null, sanityBar);
    sanityFill.id = "sanity-fill";
    this.sanityFill = sanityFill;

    const battery = this._el("div", null, hud);
    battery.id = "battery-bar";
    this.batteryEl = battery;

    const vignette = this._el("div", null, hud);
    vignette.id = "vignette";
    this.vignetteEl = vignette;

    const dread = this._el("div", null, hud);
    dread.id = "dread-overlay";
    this.dreadEl = dread;

    const jumpscare = this._el("div", null, hud);
    jumpscare.id = "jumpscare";
    this.jumpscareEl = jumpscare;
  }

  _buildPause() {
    const overlay = this._el("div", "hs-overlay hs-hidden", this.root);
    this._el("h1", "hs-title", overlay).textContent = "PAUSE";

    const btnCol = this._el("div", "hs-btn-col", overlay);
    const resume = this._el("button", "hs-btn", btnCol);
    resume.textContent = "Weiter";
    this.resumeButton = resume;

    const restart = this._el("button", "hs-btn hs-btn-secondary", btnCol);
    restart.textContent = "Neustart";
    this.pauseRestartButton = restart;

    const settings = this._el("button", "hs-btn hs-btn-secondary", btnCol);
    settings.textContent = "Einstellungen";
    this.pauseSettingsButton = settings;

    const quit = this._el("button", "hs-btn hs-btn-secondary", btnCol);
    quit.textContent = "Hauptmenü";
    this.pauseQuitButton = quit;

    this.pauseOverlay = overlay;
  }

  _sliderRow(parent, id, labelText, min, max, step, value, format) {
    const row = this._el("div", "hs-setting-row", parent);
    const label = this._el("label", "hs-setting-label", row);
    label.textContent = labelText;
    label.htmlFor = id;
    const input = this._el("input", "hs-slider", row);
    input.type = "range";
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const readout = this._el("span", "hs-setting-value", row);
    readout.textContent = format ? format(value) : String(value);
    input.addEventListener("input", () => {
      readout.textContent = format ? format(Number(input.value)) : input.value;
    });
    return input;
  }

  _buildSettings() {
    const overlay = this._el("div", "hs-overlay hs-overlay-menu hs-hidden", this.root);
    this._el("h1", "hs-title hs-title-sm", overlay).textContent = "EINSTELLUNGEN";

    const panel = this._el("div", "hs-settings-panel", overlay);
    const s = this.settings;
    const pct = (v) => `${Math.round(v * 100)}%`;

    this._el("h2", "hs-setting-group", panel).textContent = "Steuerung";
    this.sensitivitySlider = this._sliderRow(
      panel,
      "set-sens",
      "Mausempfindlichkeit",
      0.2,
      3,
      0.1,
      s.mouseSensitivity,
      (v) => v.toFixed(1)
    );
    this.fovSlider = this._sliderRow(panel, "set-fov", "Sichtfeld (FOV)", 60, 100, 1, s.fov, (v) => `${v}°`);

    const invertRow = this._el("div", "hs-setting-row", panel);
    const invertLabel = this._el("label", "hs-setting-label", invertRow);
    invertLabel.textContent = "Maus Y invertieren";
    invertLabel.htmlFor = "set-invert";
    const invertInput = this._el("input", null, invertRow);
    invertInput.type = "checkbox";
    invertInput.id = "set-invert";
    invertInput.checked = !!s.invertY;
    this.invertYCheckbox = invertInput;
    this._el("span", "hs-setting-value", invertRow).textContent = "";

    this._el("h2", "hs-setting-group", panel).textContent = "Audio";
    this.masterVolumeSlider = this._sliderRow(
      panel,
      "set-master",
      "Gesamtlautstärke",
      0,
      1,
      0.05,
      s.masterVolume,
      pct
    );
    this.musicVolumeSlider = this._sliderRow(panel, "set-music", "Musik", 0, 1, 0.05, s.musicVolume, pct);
    this.sfxVolumeSlider = this._sliderRow(panel, "set-sfx", "Effekte", 0, 1, 0.05, s.sfxVolume, pct);

    const back = this._el("button", "hs-btn", overlay);
    back.textContent = "Zurück";
    this.settingsBackButton = back;

    this.settingsOverlay = overlay;
  }

  _buildNoteOverlay() {
    const note = this._el("div", "hs-note hs-hidden", this.root);
    const title = this._el("h3", "hs-note-title", note);
    this.noteTitleEl = title;
    const text = this._el("p", "hs-note-text", note);
    this.noteTextEl = text;
    this._el("div", "hs-note-hint", note).textContent = "[E] Schließen";
    this.noteOverlay = note;
  }

  _buildEndScreens() {
    const death = this._el("div", "hs-overlay hs-hidden", this.root);
    this._el("h1", "hs-title", death).textContent = "DU BIST TOT";
    this._el("p", "hs-sub", death).textContent =
      "Die Dunkelheit unter Kreide-9 hat dich eingeholt.";
    const retryDeath = this._el("button", "hs-btn", death);
    retryDeath.textContent = "Erneut versuchen";
    this.deathOverlay = death;
    this.retryDeathButton = retryDeath;

    const win = this._el("div", "hs-overlay hs-hidden", this.root);
    win.style.background = "radial-gradient(ellipse at center, rgba(20,30,20,0.9) 0%, rgba(0,0,0,0.98) 75%)";
    const winTitle = this._el("h1", "hs-title", win);
    winTitle.textContent = "ENTKOMMEN";
    winTitle.style.color = "#3fd97a";
    winTitle.style.textShadow = "0 0 18px rgba(63,217,122,0.75)";
    this._el("p", "hs-sub", win).textContent =
      "Du erreichst die Oberfläche. Hinter dir fällt die Luke ins Schloss. Was auch immer in Kreide-9 lebt - es bleibt dort unten. Vorerst.";
    const retryWin = this._el("button", "hs-btn", win);
    retryWin.textContent = "Nochmal spielen";
    this.winOverlay = win;
    this.retryWinButton = retryWin;
  }

  showMenu() {
    this.menuOverlay.classList.remove("hs-hidden");
    this.hud.classList.add("hs-hidden");
  }
  hideMenu() {
    this.menuOverlay.classList.add("hs-hidden");
  }
  showHud() {
    this.hud.classList.remove("hs-hidden");
  }
  hideHud() {
    this.hud.classList.add("hs-hidden");
  }

  showPause() {
    this.pauseOverlay.classList.remove("hs-hidden");
  }
  hidePause() {
    this.pauseOverlay.classList.add("hs-hidden");
  }

  showSettings() {
    this.settingsOverlay.classList.remove("hs-hidden");
  }
  hideSettings() {
    this.settingsOverlay.classList.add("hs-hidden");
  }

  showNote(title, text) {
    this.noteTitleEl.textContent = title;
    this.noteTextEl.textContent = text;
    this.noteOverlay.classList.remove("hs-hidden");
  }
  hideNote() {
    this.noteOverlay.classList.add("hs-hidden");
  }

  showDeath() {
    this.deathOverlay.classList.remove("hs-hidden");
  }
  hideDeath() {
    this.deathOverlay.classList.add("hs-hidden");
  }
  showWin() {
    this.winOverlay.classList.remove("hs-hidden");
  }
  hideWin() {
    this.winOverlay.classList.add("hs-hidden");
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  setPrompt(text) {
    if (!text) {
      this.promptEl.style.display = "none";
    } else {
      this.promptEl.style.display = "block";
      this.promptEl.textContent = text;
    }
  }

  setFuseCount(count) {
    this.fusePips.forEach((pip, i) => pip.classList.toggle("on", i < count));
  }

  setSanity(value) {
    this.sanityFill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  setBattery(value) {
    const pct = Math.round(value * 100);
    this.batteryEl.textContent = `TASCHENLAMPE ${pct}%`;
  }

  setVignette(strength) {
    this.vignetteEl.style.opacity = String(0.35 + strength * 0.5);
  }

  setDread(intensity) {
    this.dreadEl.style.opacity = String(Math.max(0, Math.min(1, intensity)));
  }

  flashJumpscare() {
    this.jumpscareEl.classList.add("flash");
    setTimeout(() => this.jumpscareEl.classList.remove("flash"), 180);
  }
}
