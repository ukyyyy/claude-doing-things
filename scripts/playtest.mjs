import { chromium } from "playwright";
import path from "node:path";

const shotDir = "/tmp/claude-0/-home-user-claude-doing-things/909da88d-4345-5eab-8b31-8391ae6a3379/scratchpad";

const errors = [];

// Point PLAYWRIGHT_CHROMIUM_PATH at your local Chromium binary if Playwright's
// bundled browser isn't installed (e.g. PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
// sandboxes). Falls back to Playwright's own browser resolution otherwise.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
});

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(shotDir, "01-menu.png") });
console.log("Menu screenshot saved (live 3D background behind menu).");

// Settings-from-menu round trip.
await page.click('button:has-text("Einstellungen")');
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(shotDir, "01b-settings.png") });
const settingsVisible = await page.evaluate(() => window.__game.ui.settingsOverlay.classList.contains("hs-hidden") === false);
console.log("Settings panel visible after opening from menu:", settingsVisible);

await page.fill("#set-sens", "2");
await page.evaluate(() => document.getElementById("set-sens").dispatchEvent(new Event("input", { bubbles: true })));
await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Zurück")');
await page.waitForTimeout(200);
const afterSettingsBack = await page.evaluate(() => ({
  menuHidden: window.__game.ui.menuOverlay.classList.contains("hs-hidden"),
  sensitivity: window.__game.settings.mouseSensitivity,
}));
console.log("After settings back (should return to menu):", afterSettingsBack);

await page.click('button:has-text("Station betreten")');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(shotDir, "02-hud.png") });
console.log("HUD screenshot saved.");

const state1 = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, fuseCount: g.fuseCount };
});
console.log("After start:", state1);

// Pause menu round trip (Escape -> pause -> settings -> back -> resume).
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const pauseVisible = await page.evaluate(() => ({
  state: window.__game.state,
  pauseVisible: !window.__game.ui.pauseOverlay.classList.contains("hs-hidden"),
}));
console.log("After Escape (expect PAUSED):", pauseVisible);
await page.screenshot({ path: path.join(shotDir, "02b-pause.png") });

await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Einstellungen")');
await page.waitForTimeout(200);
await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Zurück")');
await page.waitForTimeout(200);
const afterPauseSettingsBack = await page.evaluate(() => ({
  pauseVisible: !window.__game.ui.pauseOverlay.classList.contains("hs-hidden"),
}));
console.log("After pause->settings->back (expect pause visible again):", afterPauseSettingsBack);

await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Weiter")');
await page.waitForTimeout(200);
const afterResume = await page.evaluate(() => window.__game.state);
console.log("After resume click:", afterResume);

// Let the render/enemy loop run for a while to catch runtime errors.
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(shotDir, "03-after-4s.png") });

// Note pickup: teleport to a lore note, interact, verify overlay text shows,
// then press E again to dismiss.
const noteResult = await page.evaluate(() => {
  const g = window.__game;
  const note = g.level.notes[0];
  const wp = note.getWorldPosition(new (Object.getPrototypeOf(note.position).constructor)());
  g.player.position.x = wp.x;
  g.player.position.z = wp.z;
  g.camera.position.set(wp.x, g.player._eyeHeight ?? 1.6, wp.z + 0.01);
  g.camera.lookAt(wp.x, wp.y, wp.z);
  g._tryInteract();
  return {
    noteOpenAfterInteract: g._noteOpen,
    title: g.ui.noteTitleEl.textContent,
    collected: note.userData.collected,
  };
});
console.log("Note pickup result:", noteResult);
await page.screenshot({ path: path.join(shotDir, "03f-note.png") });

await page.keyboard.press("KeyE");
await page.waitForTimeout(100);
const noteClosed = await page.evaluate(() => window.__game._noteOpen);
console.log("Note closed after second E press:", noteClosed);

// Battery pickup: drain flashlight battery, then teleport to a battery pack.
const batteryResult = await page.evaluate(() => {
  const g = window.__game;
  g.player.battery = 0.1;
  const batt = g.level.batteries[0];
  const wp = batt.getWorldPosition(new (Object.getPrototypeOf(batt.position).constructor)());
  g.player.position.x = wp.x;
  g.player.position.z = wp.z;
  g.camera.position.set(wp.x, g.player._eyeHeight ?? 1.6, wp.z + 0.01);
  g.camera.lookAt(wp.x, wp.y, wp.z);
  g._tryInteract();
  return { batteryAfterPickup: g.player.battery, collected: batt.userData.collected };
});
console.log("Battery pickup result:", batteryResult);

// Door auto-swing: place the player right at a door hinge and tick updateDoors.
const doorResult = await page.evaluate(() => {
  const g = window.__game;
  const door = g.level.doors[0];
  g.player.position.x = door.position.x;
  g.player.position.z = door.position.z;
  for (let i = 0; i < 30; i++) {
    g.level.updateDoors(0.05, g.player.position, () => {});
  }
  return { angle: door.angle, targetAngle: door.targetAngle };
});
console.log("Door swing result (angle should be > 0):", doorResult);

const stalkerInfo = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.stalker.state, pos: g.stalker.position };
});
console.log("Stalker state:", stalkerInfo);

// Teleport player to each fuse, panel, and exit to exercise pickup/win flow
// without depending on real pointer-lock mouse input in headless mode.
const flowResult = await page.evaluate(() => {
  const g = window.__game;
  const THREE_POS = (x, z) => {
    g.player.position.x = x;
    g.player.position.z = z;
    g.camera.position.set(x, g.player._eyeHeight ?? 1.6, z);
  };
  const log = [];

  for (const fuse of g.level.fuses) {
    const wp = fuse.getWorldPosition(new (Object.getPrototypeOf(fuse.position).constructor)());
    THREE_POS(wp.x, wp.z);
    g.camera.lookAt(wp.x, wp.y, wp.z);
    g._tryInteract();
    log.push({ afterFuse: fuse.userData.id, fuseCount: g.fuseCount });
  }

  const panelPos = g.level.panelMesh.getWorldPosition(
    new (Object.getPrototypeOf(g.level.panelMesh.position).constructor)()
  );
  THREE_POS(panelPos.x, panelPos.z);
  g.camera.lookAt(panelPos.x, panelPos.y, panelPos.z);
  g._tryInteract();
  log.push({ panelPowered: g.panelPowered });

  const exitPos = g.level.exitDoorMesh.getWorldPosition(
    new (Object.getPrototypeOf(g.level.exitDoorMesh.position).constructor)()
  );
  THREE_POS(exitPos.x, exitPos.z);
  g.camera.lookAt(exitPos.x, exitPos.y, exitPos.z);
  g._tryInteract();
  log.push({ state: g.state });

  return log;
});
console.log("Flow result:", JSON.stringify(flowResult, null, 2));

await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotDir, "04-win.png") });

// Win screen -> restart flow.
await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Nochmal spielen")');
await page.waitForTimeout(500);
const afterWinRestart = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, fuseCount: g.fuseCount, panelPowered: g.panelPowered };
});
console.log("After win->restart click:", afterWinRestart);
await page.screenshot({ path: path.join(shotDir, "05-after-restart.png") });

// Quit-to-menu flow via the pause menu.
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Hauptmenü")');
await page.waitForTimeout(300);
const afterQuit = await page.evaluate(() => ({
  state: window.__game.state,
  menuVisible: !window.__game.ui.menuOverlay.classList.contains("hs-hidden"),
}));
console.log("After quit-to-menu:", afterQuit);
await page.screenshot({ path: path.join(shotDir, "05b-quit-to-menu.png") });

// Re-enter and test death / jumpscare flow.
await page.click('button:has-text("Station betreten")');
await page.waitForTimeout(300);
await page.evaluate(() => window.__game._die());
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(shotDir, "06-death.png") });
const deathState = await page.evaluate(() => window.__game.state);
console.log("Death state:", deathState);

await page.click('.hs-overlay:not(.hs-hidden) button:has-text("Erneut versuchen")');
await page.waitForTimeout(500);
const afterDeathRestart = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, fuseCount: g.fuseCount };
});
console.log("After death->restart click:", afterDeathRestart);
await page.screenshot({ path: path.join(shotDir, "07-after-death-restart.png") });

await browser.close();

console.log("\n=== Console/page errors captured ===");
if (errors.length === 0) {
  console.log("NONE");
} else {
  for (const e of errors) console.log(e);
}

process.exit(errors.length ? 1 : 0);
