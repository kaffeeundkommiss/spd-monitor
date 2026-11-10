import { test, expect } from "@playwright/test";

// partei.json ist redaktionell gepflegt und ändert sich selten: die Seite wird mit der
// echten Datei getestet, nicht mit einem Fixture.
test.beforeEach(async ({ page }) => {
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
});

test("Parteiseite zeichnet Kennzahlen und alle Diagramme", async ({ page }) => {
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message));
  await page.goto("/partei.html");

  await expect(page.locator("#kennzahlen")).toContainText("40,9 %");
  await expect(page.locator("#kennzahlen")).toContainText("7 von 8");
  await expect(page.locator("#chart-wahlen rect")).toHaveCount(8);
  await expect(page.locator("#chart-zeit rect")).not.toHaveCount(0);
  await expect(page.locator("#chart-vorsitz rect")).toHaveCount(19);
  await expect(page.locator("#tabelle-vorsitz tbody tr")).toHaveCount(19);
  await expect(page.locator("#vorsitz-kennzahlen")).toContainText("Willy Brandt");
  await expect(page.locator("#vorsitz-kennzahlen")).toContainText("amtierend: Lars Klingbeil");
  expect(fehler).toEqual([]);
});

test("Reihenfolge: Wahlen, Zeitleiste, Vorsitzende; die Programme stehen auf eigener Seite", async ({ page }) => {
  await page.goto("/partei.html");
  const ids = await page.locator("main .chart").evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(["chart-wahlen", "chart-zeit", "chart-vorsitz"]);
});

test("Programmseite sagt offen, dass die Themenauswertung fehlt, und zeichnet nichts", async ({ page }) => {
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message));
  await page.goto("/programme.html");
  await expect(page.locator("main")).toContainText("noch nicht erstellt");
  await expect(page.locator("main .chart")).toHaveCount(0);
  await expect(page.locator("#stand")).toContainText("Stand ");
  expect(fehler).toEqual([]);
});

test("Parteiseite passt auf Handybreite ohne seitliches Scrollen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const seite of ["/partei.html", "/programme.html"]) {
    await page.goto(seite);
    if (seite === "/partei.html") await expect(page.locator("main .chart svg").first()).toBeVisible();
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(390);
  }
});

test("Navigation verbindet alle drei Seiten", async ({ page }) => {
  await page.route("**/api.dawum.de/**", (r) => r.abort());
  await page.goto("/index.html");
  await expect(page.locator('nav.seiten a[aria-current="page"]')).toHaveText("Umfragen");
  await page.locator("nav.seiten a", { hasText: "Partei" }).click();
  await expect(page).toHaveURL(/partei\.html$/);
  await expect(page.locator('nav.seiten a[aria-current="page"]')).toHaveText("Partei");
  await page.locator("nav.seiten a", { hasText: "Programme" }).click();
  await expect(page).toHaveURL(/programme\.html$/);
  await expect(page.locator('nav.seiten a[aria-current="page"]')).toHaveText("Programme");
});

test("Zeitleiste am Handy: Farblegende und Namen der unbeschrifteten Balken", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/partei.html");
  await expect(page.locator("#legende-zeit")).toContainText("Opposition");
  // Die SPD war seit 1949 immer im Bundestag: keine Legende für eine Rolle ohne Daten.
  await expect(page.locator("#legende-zeit")).not.toContainText("Nicht im Bundestag");
  const schl = page.locator("#schluessel-zeit");
  await expect(schl).toBeVisible();
  await expect(schl).toContainText("Platzeck");
  await expect(schl).toContainText("Berliner Programm");
  await expect(schl).toContainText("Neues Grundsatzprogramm");
});

test("Quellen der Parteiseite widersprechen sich nicht", async ({ page }) => {
  // Die Neuwahl der Spitze ist mit ZDF belegt; dann muss ZDF auch genannt sein.
  await page.goto("/partei.html");
  await expect(page.locator("main")).toContainText("ZDF, 12.10.2026");
  await expect(page.locator("footer")).not.toContainText("partei.json");
});

test("Zeitleiste am Desktop: Schlüssel nur für Spuren, deren Balken zu schmal sind", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/partei.html");
  const schl = page.locator("#schluessel-zeit");
  await expect(schl).not.toContainText("Hamburger");  // passt beschriftet in den Balken
});
