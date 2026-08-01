const STORY_TEXT = `Forschungsstation "KREIDE-9", 340 Meter unter der Oberfläche.

Vor sechs Stunden brach der Funkkontakt ab. Du bist der Wartungstechniker,
der zur Inspektion runtergeschickt wurde. Die Aufzüge sind tot. Die Notstromversorgung
ist ausgefallen. Und irgendetwas anderes ist hier unten nicht mehr allein.

Finde die drei Sicherungen, aktiviere den Generator im Maschinenraum
und verlasse die Station - bevor sie dich findet.`;

export class UIManager {
  constructor(root) {
    this.root = root;
    this._buildMenu();
    this._buildHud();
    this._buildPause();
    this._buildEndScreens();
  }

  _el(tag, className, parent) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (parent) parent.appendChild(e);
    return e;
  }

  _buildMenu() {
    const overlay = this._el("div", "hs-overlay", this.root);
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

    const btn = this._el("button", "hs-btn", overlay);
    btn.textContent = "Station betreten";
    this.startButton = btn;
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
    const resume = this._el("button", "hs-btn", overlay);
    resume.textContent = "Weiter";
    this.resumeButton = resume;
    this.pauseOverlay = overlay;
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
