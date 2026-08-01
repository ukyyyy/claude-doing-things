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
console.log("Menu screenshot saved.");

await page.click(".hs-btn");
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(shotDir, "02-hud.png") });
console.log("HUD screenshot saved.");

const state1 = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, fuseCount: g.fuseCount };
});
console.log("After start:", state1);

// Let the render/enemy loop run for a while to catch runtime errors.
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(shotDir, "03-after-4s.png") });

// Visual-only checks: pause the sim loop so our manual camera placement
// isn't clobbered by PlayerController.update() on the next animation frame.
await page.evaluate(() => {
  window.__game.state = "PAUSED_FOR_SCREENSHOT";
});

// Flashlight-on view down the corridor toward the hub.
await page.evaluate(() => {
  const g = window.__game;
  g.player.flashlightOn = true;
  g.player.flashlight.intensity = 140;
  g.camera.position.set(22, 1.6, 30);
  g.camera.up.set(0, 1, 0);
  g.camera.lookAt(22, 1.6, 60);
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotDir, "03b-flashlight-corridor.png") });

// Storage room close-up (crates + fuse glow).
await page.evaluate(() => {
  const g = window.__game;
  g.camera.position.set(100, 1.6, 12);
  g.camera.lookAt(112, 1.2, 20);
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotDir, "03c-storage-fuse.png") });

// Bird's-eye overview of the whole station layout.
await page.evaluate(() => {
  const g = window.__game;
  g.camera.position.set(68, 90, 58);
  g.camera.up.set(0, 0, -1);
  g.camera.lookAt(68, 0, 58);
  g.camera.up.set(0, 1, 0);
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotDir, "03d-birdseye.png") });

// Face the stalker enemy directly for a mesh/animation check.
await page.evaluate(() => {
  const g = window.__game;
  const sp = g.stalker.position;
  g.player.flashlightOn = true;
  g.player.flashlight.intensity = 140;
  g.camera.position.set(sp.x, 1.6, sp.z - 3);
  g.camera.lookAt(sp.x, 1.4, sp.z);
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotDir, "03e-enemy.png") });

// Resume normal simulation for the rest of the playtest.
await page.evaluate(() => {
  window.__game.state = "PLAYING";
});

const stalkerInfo = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.stalker.state, pos: g.stalker.position };
});
console.log("Stalker after 4s:", stalkerInfo);

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
await page.waitForTimeout(200);
await page.click(".hs-overlay:not(.hs-hidden) .hs-btn");
await page.waitForTimeout(500);
const afterWinRestart = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, fuseCount: g.fuseCount, panelPowered: g.panelPowered };
});
console.log("After win->restart click:", afterWinRestart);
await page.screenshot({ path: path.join(shotDir, "05-after-restart.png") });

// Death / jumpscare flow.
await page.evaluate(() => {
  window.__game._die();
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(shotDir, "06-death.png") });
const deathState = await page.evaluate(() => window.__game.state);
console.log("Death state:", deathState);

await page.click(".hs-overlay:not(.hs-hidden) .hs-btn");
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
