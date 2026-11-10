# spd-monitor
Overview of SPD polling results (Bundestag + Landtagswahlen), sorted by election date and compared with the previous election result (`index.html`),
plus a page with statistics on the party at federal level since 1998 (`partei.html`) and a placeholder for the manifesto analysis (`programme.html`); both read `partei.json` via `partei-seite.js` and `partei.css`.

Built from the same code as [fdp-monitor](https://github.com/kaffeeundkommiss/fdp-monitor). Party-specific: `PARTEI` in `monitor-utils.js` and `update.py`, `vorwahl` per level in `data.json`.

## Tests

```
pip install -r requirements-dev.txt && pytest              # update.py
npm install && npm test                                    # monitor-utils.js, partei-utils.js (Vitest)
npm install && npx playwright install chromium && npm run test:e2e   # index.html, partei.html, programme.html (Playwright)
```
