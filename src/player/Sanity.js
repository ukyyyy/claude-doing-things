const DRAIN_DARK = 0.9; // per second, when not flashlit and outside a safe zone
const DRAIN_CHASE = 6.0; // per second, while the stalker is actively chasing
const DRAIN_NEAR = 2.2; // per second, when stalker is close but not chasing
const REGEN_SAFE = 4.5; // per second, in a lit safe zone

export class SanitySystem {
  constructor() {
    this.value = 100;
    this.whisperCooldown = 4 + Math.random() * 4;
    this.onWhisper = null;
    this.onHallucination = null;
    this._hallucinationCooldown = 20;
  }

  update(dt, { inSafeZone, flashlightOn, enemyDistance, enemyChasing }) {
    let delta = 0;
    if (inSafeZone) {
      delta += REGEN_SAFE;
    } else {
      if (!flashlightOn) delta -= DRAIN_DARK;
      if (enemyChasing) delta -= DRAIN_CHASE;
      else if (enemyDistance < 9) delta -= DRAIN_NEAR * (1 - enemyDistance / 9);
    }

    this.value = Math.max(0, Math.min(100, this.value + delta * dt));

    const dread = 1 - this.value / 100;
    this.whisperCooldown -= dt * (0.4 + dread * 1.6);
    if (this.whisperCooldown <= 0 && this.value < 65) {
      this.whisperCooldown = 5 + Math.random() * 9;
      if (this.onWhisper) this.onWhisper(dread);
    }

    this._hallucinationCooldown -= dt;
    if (this.value < 25 && this._hallucinationCooldown <= 0) {
      this._hallucinationCooldown = 14 + Math.random() * 10;
      if (this.onHallucination) this.onHallucination();
    }

    return {
      value: this.value,
      dread,
      vignetteStrength: 0.55 + dread * 0.4,
      distortion: Math.max(0, dread - 0.35) / 0.65,
    };
  }
}
