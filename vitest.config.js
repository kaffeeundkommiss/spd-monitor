import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/*.test.js"],
    // Bewusst nicht UTC: Datumsfehler, die auf die Zeitzone des Lesers hereinfallen,
    // bleiben in UTC unsichtbar. Westlich von Greenwich zeigen sie sich sofort.
    env: { TZ: "America/Los_Angeles" },
  },
});
