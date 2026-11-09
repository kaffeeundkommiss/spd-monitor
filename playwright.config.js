import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "python3 -m http.server 4173",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Siehe vitest.config.js: in UTC bleiben Zeitzonenfehler bei Datumsangaben
    // unsichtbar. Der Browser der Tests steht deshalb westlich von Greenwich.
    timezoneId: "America/Los_Angeles",
    locale: "de-DE",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
    },
  },
});
