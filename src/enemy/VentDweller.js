// A second, much simpler threat: something lives in the vent shortcut.
// Rather than a fully simulated creature with its own pathfinding, it is
// modeled as a lingering-danger timer - dawdling in the vents is what
// gets you, which keeps the shortcut genuinely risky without needing a
// second full AI stack.

const DANGER_THRESHOLD = 6.5; // seconds lingering in a vent before it finds you
const WARNING_START = 3.5; // seconds before threshold when tension audio starts
const RECOVERY_RATE = 2.5; // timer drains this many times faster once you leave

export class VentDweller {
  constructor() {
    this.timer = 0;
    this.warned = false;
    this.triggered = false;
    this.onWarningPulse = null; // callback(danger 0..1)
    this.onTrigger = null; // callback()
    this._scratchCooldown = 1.2;
  }

  update(dt, inVent) {
    if (inVent) {
      this.timer += dt;
    } else {
      this.timer = Math.max(0, this.timer - dt * RECOVERY_RATE);
      this.warned = false;
    }

    if (this.timer >= WARNING_START && !this.triggered) {
      this.warned = true;
      this._scratchCooldown -= dt;
      if (this._scratchCooldown <= 0) {
        const danger = Math.min(1, (this.timer - WARNING_START) / (DANGER_THRESHOLD - WARNING_START));
        this._scratchCooldown = 0.9 - danger * 0.5;
        if (this.onWarningPulse) this.onWarningPulse(danger);
      }
    }

    if (this.timer >= DANGER_THRESHOLD && !this.triggered) {
      this.triggered = true;
      if (this.onTrigger) this.onTrigger();
    }

    return {
      warned: this.warned,
      danger: Math.min(1, this.timer / DANGER_THRESHOLD),
    };
  }

  reset() {
    this.timer = 0;
    this.warned = false;
    this.triggered = false;
  }
}
