import { test, expect } from "@playwright/test";

// Teilen über Social Media und Blogposts: Vorschaukarten, Permalinks, Momentaufnahmen,
// Belege an den Zahlen. Die Seite wird mit festen Daten geladen, dawum ist tot.

const ERSTELLT = "2026-11-02T09:20+01:00";
const DATEN = {
  erstellt: ERSTELLT,
  ebenen: [
    { id: "bund", name: "Bundestagswahl", kurz: "Bund", css: "bund", parlament_regex: "bundestag",
      dawum_slug: "Bundestag", wahltermin: null, umfrage_max_alter_tage: 60, wahltrend_max_alter_tage: 21,
      wahlergebnis: null, wahltrend: { wert: 4.0, delta: 0.1, stand: "2026-10-31" },
      umfragen: { stand: "2026-11-01T15:34:27+01:00", rows: [
        { institut: "INSA", datum: "2026-10-31", wert: 5.0 }, { institut: "Forsa", datum: "2026-10-27", wert: 4.0 }] } },
    { id: "bremen", name: "Bürgerschaftswahl Bremen", kurz: "HB", css: "land", parlament_regex: "brem",
      dawum_slug: "Bremen", wahltermin: "2027-05-30", umfrage_max_alter_tage: 180, wahltrend_max_alter_tage: 21,
      wahlergebnis: null, wahltrend: { wert: null, delta: null, stand: null },
      umfragen: { stand: "2026-11-01", rows: [{ institut: "Infratest dimap", datum: "2026-10-01", wert: 4.0 }] } },
    { id: "berlin", name: "Abgeordnetenhauswahl Berlin", kurz: "BE", css: "land", parlament_regex: "berlin",
      dawum_slug: "Berlin", wahltermin: "2026-09-20", umfrage_max_alter_tage: 180, wahltrend_max_alter_tage: 21,
      wahlergebnis: { wert: 2.5, datum: "2026-09-20",
        quelle: { name: "Landeswahlleiter Berlin", url: "https://wahlen-berlin.de/wahlen/BE2026/Afspraes/agh/index.html" } },
      vorwahl: { wert: 18.4, jahr: 2023 },
      wahltrend: { wert: null, delta: null, stand: null }, umfragen: { stand: "2026-09-20", rows: [] } },
  ],
};

async function laden(page, pfad = "/index.html", { archiv = ["2026-KW44", "2026-KW45"] } = {}) {
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await page.route("**://api.dawum.de/**", (r) => r.abort("failed"));
  await page.route("**/data.json*", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(DATEN) }));
  await page.route("**/archiv/index.json*", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(archiv) }));
  await page.route("**/archiv/2026-KW45.json*", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(DATEN) }));
  await page.goto(pfad);
}

test.describe("Vorschaukarten", () => {
  for (const [seite, bild] of [["/index.html", "og/umfragen.png"], ["/partei.html", "og/partei.png"]]) {
    test(`${seite} hat Open Graph, Twitter Card und canonical`, async ({ page, request }) => {
      await page.goto(seite);
      const meta = (sel) => page.locator(sel).getAttribute("content");
      expect(await meta('meta[property="og:image"]')).toMatch(new RegExp("^https://.+/" + bild + "$"));
      expect(await meta('meta[property="og:title"]')).toContain("SPD-Monitor");
      expect(await meta('meta[property="og:description"]')).toBeTruthy();
      expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/^https:\/\//);
      // Das Bild liegt im Repo und hat das Format, das die Plattformen erwarten.
      const res = await request.get("/" + bild);
      expect(res.status()).toBe(200);
      const png = await res.body();
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
    });
  }
});

test.describe("Belege und Einordnung", () => {
  test("ein gelaufenes Ergebnis verlinkt seine amtliche Quelle", async ({ page }) => {
    await laden(page);
    const a = page.locator("#zeile-berlin .beleg a");
    await expect(a).toHaveText("Landeswahlleiter Berlin");
    await expect(a).toHaveAttribute("href", /^https:\/\/wahlen-berlin\.de\//);
  });

  test("ohne Trendwerte gibt es keine leere Trend-Spalte", async ({ page }) => {
    await laden(page);
    await expect(page.locator("#gelaufen-tabelle th")).not.toContainText(["Letzter Trend"]);
  });

  test("ein Wert aus nur einer Umfrage ist als wenig belastbar markiert, auch am Handy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await laden(page);
    await expect(page.locator("#kachel-bremen .duenn")).toBeVisible();
    await expect(page.locator("#kachel-bremen .duenn")).toContainText("Nur eine Umfrage");
  });

  test("der Hero nennt Quelle, Trend-Datum und die Unschärfe einer Einzelumfrage", async ({ page }) => {
    await laden(page);
    await expect(page.locator("#bund-hero .quelle")).toContainText("Wahltrend vom 31.10.2026");
    await expect(page.locator("#bund-hero .unschaerfe")).toContainText("±1,2 Punkten");
  });

  test("am Handy passt die Tabelle der gelaufenen Wahlen ohne Querscrollen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await laden(page);
    const t = page.locator("#gelaufen-tabelle");
    const breiten = await t.evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(breiten[0]).toBeLessThanOrEqual(breiten[1] + 1);
  });
});

test.describe("Permalinks", () => {
  test("jeder Abschnitt hat Link- und Bild-Knopf", async ({ page }) => {
    await laden(page);
    for (const id of ["bund-hero", "anstehend", "gelaufen"]) {
      await expect(page.locator(`#${id} > .teilen-leiste .teilen-knopf`)).toHaveText(["Link kopieren", "Als Bild"]);
      // Auch am Desktop groß genug zum Treffen (früher 30 px).
      const box = await page.locator(`#${id} > .teilen-leiste .teilen-knopf`).first().boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });

  test("Link kopiert die Adresse mit Anker", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await laden(page);
    await page.locator("#gelaufen .teilen-knopf", { hasText: "Link kopieren" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/index\.html#gelaufen$/);
  });

  test("ein #Anker aus einem geteilten Link wird nach dem Rendern angesprungen", async ({ page }) => {
    await laden(page, "/index.html#gelaufen");
    await expect(page.locator("#gelaufen")).toBeInViewport();
  });

  test("Bild speichert ein PNG mit Fußzeile und ohne Knöpfe", async ({ page }) => {
    await laden(page);
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#gelaufen .teilen-knopf", { hasText: "Als Bild" }).click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/^spd-monitor-gelaufen-\d{4}-\d{2}-\d{2}\.png$/);
    // Die Fußzeile ist nur fürs Bild da und verschwindet danach wieder.
    await expect(page.locator(".teilen-fuss")).toHaveCount(0);
  });
});

test.describe("Momentaufnahmen", () => {
  test("„Diesen Stand verlinken“ kopiert den Link auf die Kalenderwoche", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await laden(page);
    await page.locator("#stand-link").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/index\.html\?stand=2026-KW45$/);
  });

  test("?stand= zeigt die archivierte Fassung ohne Live-Abruf", async ({ page }) => {
    let live = false;
    await page.route("**://api.dawum.de/**", (r) => { live = true; r.abort("failed"); });
    await laden(page, "/index.html?stand=2026-KW45");
    await expect(page.locator("#stand")).toHaveText("Momentaufnahme KW 45/2026");
    await expect(page.locator("#momentaufnahme")).toContainText("ohne Live-Daten");
    await expect(page.locator("#stand-link")).toBeHidden();
    // Countdown vom Tag der Aufnahme aus gerechnet, nicht von heute.
    await expect(page.locator("#kachel-bremen .tage")).toHaveText("in 209 T.");
    expect(live).toBe(false);
  });

  test("eine unbekannte Woche sagt das, statt leer zu bleiben", async ({ page }) => {
    await page.route("**/archiv/2020-KW01.json*", (r) => r.fulfill({ status: 404, body: "" }));
    await laden(page, "/index.html?stand=2020-KW01");
    await expect(page.locator("#momentaufnahme")).toContainText("gibt es nicht");
  });

  test("der Fuß verlinkt frühere Stände, neueste zuerst", async ({ page }) => {
    await laden(page);
    await expect(page.locator("#archiv a")).toHaveText(["KW 45/2026", "KW 44/2026"]);
    await expect(page.locator("#archiv a").first()).toHaveAttribute("href", "?stand=2026-KW45");
  });
});

test.describe("Parteiseite", () => {
  test("jeder Diagrammabschnitt nennt seine Quelle und lässt sich teilen", async ({ page }) => {
    await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
    await page.goto("/partei.html");
    await expect(page.locator("#bundestagswahlen .quelle a").first()).toHaveAttribute("href", /bundestag\.de/);
    await expect(page.locator("#bundestagswahlen .quelle a")).toHaveCount(2);
    await expect(page.locator("#vorsitzende .quelle")).toContainText("nicht vollständig gegen Primärquellen geprüft");
    await expect(page.locator(".teilen-leiste")).toHaveCount(3);
  });
});

test.describe("Zeitverlauf am Handy", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 900 } });

  test("der Tooltip bleibt nach dem Antippen stehen und geht bei Tipp daneben weg", async ({ page }) => {
    const verlauf = [];
    for (let i = 60; i >= 1; i -= 3)
      verlauf.push({ institut: "INSA", datum: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), wert: 4 + (i % 2) });
    const d = JSON.parse(JSON.stringify(DATEN));
    d.ebenen[0].verlauf_tage = 90;
    d.ebenen[0].verlauf = { stand: ERSTELLT, rows: verlauf };
    await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
    await page.route("**://api.dawum.de/**", (r) => r.abort("failed"));
    await page.route("**/data.json*", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(d) }));
    await page.goto("/index.html");
    const svg = page.locator("#verlauf-chart svg");
    await svg.scrollIntoViewIfNeeded();
    const box = await svg.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await expect(page.locator(".fv-tip")).toBeVisible();
    await page.touchscreen.tap(box.x + 20, box.y - 60);
    await expect(page.locator(".fv-tip")).toBeHidden();
  });
});

test.describe("Ladeprobleme", () => {
  test("data.json nicht abrufbar: verständlicher Fehlerhinweis statt leerer Seite", async ({ page }) => {
    await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
    await page.route("**://api.dawum.de/**", (r) => r.abort("failed"));
    await page.route("**/data.json*", (r) => r.fulfill({ status: 500, body: "" }));
    await page.goto("/index.html");
    await expect(page.locator("#stand")).toHaveText("Daten nicht geladen");
    await expect(page.locator("#bund-hero .fehler")).toContainText("nicht abrufbar");
  });

  test("dawum antwortet nicht: Seite zeigt nach der Zeitbegrenzung die gespeicherten Werte", async ({ page }) => {
    await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
    await page.route("**://api.dawum.de/**", () => {}); // hängt, keine Antwort
    await page.route("**/data.json*", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(DATEN) }));
    await page.goto("/index.html");
    await expect(page.locator("#stand")).toContainText("Aktualisiert");
    await expect(page.locator("#bund-hero .fehler")).toHaveCount(0);
    await expect(page.locator("#bund-hero")).not.toBeEmpty({ timeout: 10000 });
  });
});
