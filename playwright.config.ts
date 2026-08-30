import { defineConfig } from "@playwright/test";

import { E2E_AUTH_SECRET, E2E_BASE_URL, requireE2eDatabaseUrl } from "./tests/e2e/e2e-environment";

const e2eDatabaseUrl = requireE2eDatabaseUrl();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: E2E_BASE_URL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      APP_BASE_URL: E2E_BASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      DATABASE_URL: e2eDatabaseUrl,
    },
  },
});
