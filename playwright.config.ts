import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5178",
    channel: "msedge",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:client -- --port 5178 --strictPort",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: false,
    env: { VITE_ADMIN_PIN: "test-admin-key" },
  },
});
