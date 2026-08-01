# Produktplan: "FixLoop" — der KI-Debugger, der Entwickler süchtig macht

> Antwort auf die Vorgabe: **eine Web-App, die für Entwickler zum "Must-have" wird** — mit eingebautem viralen Wachstumsmechanismus.

## 1. Problem

Jeder Entwickler kopiert mehrmals täglich eine Fehlermeldung/einen Stacktrace in Google, Stack Overflow oder ChatGPT. Aktuelle Realität:

- **Stack Overflow verödet.** Neue Fragen sind seit 2022 um >50 % eingebrochen, Antworten fehlen besonders für neue Frameworks/Versionen.
- **ChatGPT/Copilot halluzinieren** ohne Projektkontext (Dependency-Versionen, Config, Stack) und liefern generische Antworten.
- **Wissen verpufft.** Jedes Team debuggt denselben Fehler in Slack/Discord neu, statt aus einer öffentlichen Wissensbasis zu schöpfen.

Die Lücke: ein Tool, das (a) *sofort* eine kontextbewusste Lösung liefert und (b) diese Lösung dauerhaft, durchsuchbar und teilbar macht — also die alte SO-Funktion mit KI-Geschwindigkeit kombiniert.

## 2. Produktkonzept: FixLoop

**Ein-Satz-Pitch:** *"Füge deinen Fehler ein, bekomm in Sekunden einen KI-Fix mit Projektkontext — und jeder Fix wird zu einer öffentlichen, google-indexierbaren Seite, die den nächsten Entwickler mit demselben Problem zu FixLoop bringt."*

### Kernidee: der virale Loop ist eingebaut, nicht nachträglich angeklebt

```
Dev A hat Fehler X
   → fügt Stacktrace + Kontext (package.json, Node-Version, Framework) in FixLoop ein
   → KI liefert Fix + Erklärung in <10s
   → Fix wird automatisch als öffentliche, permanente URL gespeichert (fixloop.dev/f/xyz)
   → Dev A teilt Link in Slack/PR/Issue ("hier, hab ich schon gelöst")
   → Google indexiert die Seite
   → Dev B sucht später denselben Fehler → landet über Google auf FixLoop
   → Dev B nutzt die App selbst für seinen nächsten Fehler
```

Das ist exakt der Mechanismus, der Stack Overflow einst groß gemacht hat (SEO + Community-Wissen), nur mit KI statt Wartezeit auf eine menschliche Antwort.

## 3. Zielgruppe

- **Primär:** Professionelle Entwickler (Web/Backend/Mobile), die täglich mit Fehlermeldungen arbeiten — Einzelentwickler bis Teams in Startups/Scale-ups.
- **Sekundär:** Bootcamp-Absolventen/Junior-Devs (hohe Fehlerfrequenz, hohe Bereitschaft zu teilen).
- **Einstiegspunkt viral:** jeder, der über Google/Slack auf einen bereits gelösten Fix stößt — Conversion zu Nutzer ohne aktive Akquise.

## 4. MVP-Funktionsumfang

| Feature | Beschreibung | Priorität |
|---|---|---|
| Fehler-Eingabe | Stacktrace/Fehlermeldung + optional Code-Snippet, Sprache/Framework, Dependency-Versionen (aus package.json/requirements.txt hochladbar) | P0 |
| KI-Diagnose | Kontextbewusster Fix-Vorschlag inkl. Ursache, Lösung, Codebeispiel | P0 |
| Permanente Fix-Seite | Jede Lösung bekommt eine eigene, SEO-optimierte, öffentliche URL | P0 |
| One-Click-Share | Copy-Link, Slack/Discord-Preview-Card, "In README/PR verlinken" | P0 |
| Ähnliche Fixes | Automatisches Matching gegen bereits gelöste Fehler (Vektor-Suche) | P1 |
| CLI/Browser-Extension | Fehler direkt aus Terminal/Devtools an FixLoop schicken | P1 |
| Team-Workspace | Private Fixes für interne/proprietäre Fehler, Team-Wissensbasis | P1 (Monetarisierung) |
| Slack/Discord-Bot | Postet automatisch Fix-Vorschlag, wenn ein Fehler im Kanal geteilt wird | P2 |

## 5. Differenzierung

| | Stack Overflow | ChatGPT | GitHub Copilot Chat | **FixLoop** |
|---|---|---|---|---|
| Sofortige Antwort | ❌ (Stunden/Tage) | ✅ | ✅ | ✅ |
| Öffentlich, google-indexiert, permanent | ✅ | ❌ | ❌ | ✅ |
| Projektkontext (Versionen, Deps) | teils | ❌ (manuell) | ✅ (nur im Editor) | ✅ (strukturiert erfasst) |
| Community-Wissensdatenbank wächst automatisch | ✅ (aber stagnierend) | ❌ | ❌ | ✅ |
| Teilbar als Artefakt (Link/Card) | ✅ | ❌ | ❌ | ✅ (Kernmechanik) |

## 6. Monetarisierung

- **Free:** Unbegrenzte öffentliche Fixes (treibt SEO/Viralität), Rate-Limit pro Tag.
- **Pro (Einzelperson, ~8–12 €/Monat):** Private Fixes, höhere Limits, CLI/Extension.
- **Team (pro Seat):** Private Team-Wissensbasis, Slack-Bot, Audit-Log, SSO.
- **API/Enterprise:** Einbindung in CI-Pipelines (Fix-Vorschlag direkt bei Build-Fehler).

Wichtig: Free-Tier bleibt öffentlich, weil genau das den viralen SEO-Loop antreibt — Monetarisierung sitzt auf "privat/Team", nicht auf der Wachstumsmechanik.

## 7. Tech-Stack-Empfehlung (Web-App)

- **Frontend:** Next.js (React) — SSR/ISR nötig für SEO-Indexierung der Fix-Seiten, Vercel-Hosting.
- **Backend:** Next.js API Routes oder separates Node/TS-Backend; Postgres (Fixes, User, Teams) + pgvector oder eine Vektor-DB (z. B. Qdrant) für "ähnliche Fehler"-Suche.
- **KI-Layer:** Anthropic Claude API (Sonnet für Standardfälle, ggf. Haiku für schnelle Erst-Klassifikation, Opus für komplexe Multi-File-Kontexte) mit strukturiertem Prompt (Stacktrace + Kontextdaten).
- **Auth:** Clerk/Auth.js (GitHub-OAuth naheliegend, da Zielgruppe Entwickler).
- **Suche/SEO:** statisch generierte Fix-Seiten (ISR), Sitemap-Generierung, strukturierte Daten (Schema.org `QAPage`).
- **Browser-Extension:** WebExtension (Manifest V3) für Chrome DevTools-Integration (P1).

## 8. Erfolgsmetriken (KPIs)

- **Viralitätskoeffizient:** Anteil neuer Nutzer, die über eine geteilte Fix-Seite kommen (Ziel: >40 % organischer Traffic über SEO/Share statt bezahlt).
- **Time-to-Fix:** Median-Zeit von Fehler-Eingabe bis akzeptierter Lösung (<15s).
- **Fix-Wiederverwendungsrate:** Wie oft eine bestehende Fix-Seite statt einer Neugenerierung trifft (steigt mit Datenbankgröße → Netzwerkeffekt).
- **D7/D30-Retention** der registrierten Nutzer.

## 9. Risiken & Gegenmaßnahmen

| Risiko | Mitigation |
|---|---|
| KI-Fixes sind falsch/veraltet | Community-Voting ("hat geholfen"/"nicht gelöst"), Versionierung von Fixes |
| Proprietärer Code landet öffentlich | Klare Trennung Public/Private-Modus, automatische Secret-Erkennung vor Speicherung |
| Google/ChatGPT bauen ähnliches Feature nativ | Moat = kuratierte, kontext-strukturierte Datenbank + Community-Verifizierung, nicht das reine LLM |
| Kaltstart-Problem (leere Fix-Datenbank) | Erstbefüllung mit Top-1000-Fehlern aus Open-Source-Issue-Trackern (GitHub Issues) vor Launch |

## 10. Roadmap

- **Phase 0 (2 Wochen):** Prototyp — Fehler-Eingabe → Claude-Fix → statische Fix-Seite, kein Login.
- **Phase 1 (4–6 Wochen):** Öffentliche Beta — Share-Mechanik, SEO-Grundlagen, Ähnliche-Fixes-Suche, GitHub-Login.
- **Phase 2 (6–8 Wochen):** Monetarisierung — Team-Workspace, private Fixes, CLI.
- **Phase 3:** Browser-Extension, Slack/Discord-Bot, CI-Integration.

## 11. Warum das "unverzichtbar" wird

Der Loop braucht keine Marketingkampagne, weil jeder Share ein SEO-Backlink ist und jeder gelöste Fehler die Datenbank für alle anderen wertvoller macht (klassischer Netzwerkeffekt à la Stack Overflow). Die App wird nicht durch Werbung viral, sondern weil das Teilen eines Fixes der schnellste Weg ist, einem Kollegen zu helfen — genau wie früher der SO-Link.
