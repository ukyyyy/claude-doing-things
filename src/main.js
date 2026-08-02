import "./style.css";
import { Game } from "./core/Game.js";

const canvas = document.getElementById("scene");
const uiRoot = document.getElementById("ui-root");

const game = new Game(canvas, uiRoot);

// Exposed for manual debugging / automated playtesting in the console.
window.__game = game;

const preload = document.getElementById("preload");
if (preload) {
  preload.style.transition = "opacity 0.3s ease";
  preload.style.opacity = "0";
  setTimeout(() => preload.remove(), 320);
}
