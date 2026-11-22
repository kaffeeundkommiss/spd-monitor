# spd-monitor
Overview of SPD polling results (Bundestag + Landtagswahlen), sorted by election date and compared with the previous election result (`index.html`),
plus a page with statistics on the party at federal level since 1998 (`partei.html`); it reads `partei.json` via `partei-seite.js` and `partei.css`.

Built from the same code as [fdp-monitor](https://github.com/kaffeeundkommiss/fdp-monitor). Party-specific: `PARTEI` in `monitor-utils.js` and `update.py`, `vorwahl` per level in `data.json`.

## Tests

```
pip install -r requirements-dev.txt && pytest              # update.py
npm install && npm test                                    # monitor-utils.js, partei-utils.js (Vitest)
npm install && npx playwright install chromium && npm run test:e2e   # index.html, partei.html (Playwright)
```

## Diagrammbeschriftung (seit 22.11.2026)

Jedes Diagramm trägt ein Kennzeichen als Text (`.art` in `bereich.css`): **Umfragen** (gestrichelter Rahmen),
**Amtliche Ergebnisse** (schwarz) oder **Chronik**. Dazu Titel, Einheit (%), Zeitraum, Quelle und Stand.
Die Texte stehen in `index.html`, `partei.html`, `partei-seite.js` und `og/make-og.py`; `update.py` schreibt nur Daten
und überschreibt sie nicht. Vergleichslinien heißen „Wahl JJJJ (amtlich)“.
