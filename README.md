# HOLLOW STATION

Ein solo 3D-Horror-Web-Game, gebaut mit [Three.js](https://threejs.org/) und Vite.
Läuft komplett im Browser - keine externen Asset-Downloads, keine Server-Backend,
keine Lizenzrisiken: jede Textur, jedes Monster-Mesh und jeder Sound wird zur
Laufzeit prozedural erzeugt (Canvas-Texturen, Three.js-Primitives, Web Audio API).

## Story

Forschungsstation "Kreide-9", 340 Meter unter der Oberfläche. Der Funkkontakt ist
abgebrochen, die Notstromversorgung ausgefallen. Als Wartungstechniker musst du
drei Sicherungen finden, den Generator im Maschinenraum aktivieren und die Station
verlassen - während dich etwas durch die Gänge verfolgt.

## Starten

Am einfachsten per Skript (installiert Abhängigkeiten beim ersten Mal automatisch
und öffnet den Browser):

```bash
./start.sh
```

Voraussetzung ist [Node.js](https://nodejs.org/) (Version 18+). Auf Windows im
Terminal von Git Bash oder WSL ausführen, oder manuell:

```bash
npm install
npm run dev
```

Dann im Browser öffnen (Vite gibt die URL aus, standardmäßig `http://localhost:5173`).

## Steuerung

| Taste  | Aktion                        |
| ------ | ------------------------------ |
| WASD   | Bewegen                        |
| Shift  | Sprinten (macht Lärm)          |
| C      | Ducken (leise, langsamer)      |
| F      | Taschenlampe (verbraucht Akku) |
| E      | Interagieren                   |
| Maus   | Umsehen                        |
| Esc    | Pause                          |

## Architektur

```
src/
  core/Game.js          - Hauptschleife, State-Machine (Menu/Playing/Paused/Dead/Won)
  world/levelLayout.js  - reine Grid-Daten (Räume, Korridore, Lüftungsschacht-Shortcut)
  world/Level.js         - baut die 3D-Geometrie aus dem Grid (InstancedMesh-Wände, Props, Lichter)
  world/AssetFactory.js  - prozedurale Canvas-Texturen & Materialien
  player/PlayerController.js - Pointer-Lock-Steuerung, Kollision, Taschenlampe
  player/Sanity.js       - Sanity-System (Dunkelheit/Nähe zum Gegner senkt Sanity)
  enemy/Stalker.js        - Gegner-KI (Patrol/Investigate/Chase/Search)
  enemy/Pathfinder.js     - BFS-Pathfinding auf dem Grid
  audio/AudioManager.js   - komplett synthetisierter Sound (Web Audio API)
  ui/UIManager.js         - Menü, HUD, Game-Over/Win-Screens
```

Das Levelgrid ist reine Daten (keine Three.js-Abhängigkeit) und wird per BFS
validiert, bevor daraus 3D-Geometrie gebaut wird:

```bash
npm run validate-level
```

## Automatisierter Smoke-Test

`scripts/playtest.mjs` fährt mit Playwright den kompletten Spielablauf ab (Menü
→ Start → Sicherungen einsammeln → Generator → Ausgang → Sieg, sowie den
Tod/Neustart-Flow) und meldet JS-Konsolenfehler. Erfordert einen laufenden
Dev-Server auf Port 5173:

```bash
npm run dev &
node scripts/playtest.mjs
```

Falls Playwrights gebündeltes Chromium nicht installiert ist, `PLAYWRIGHT_CHROMIUM_PATH`
auf einen lokalen Chromium-Pfad setzen.
