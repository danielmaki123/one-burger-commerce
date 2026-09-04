import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3011";
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;
const localDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/oneburger?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        env: {
          ...process.env,
          APP_ENV: process.env.APP_ENV ?? "dev",
          DATABASE_URL: localDatabaseUrl,
          NODE_ENV: process.env.NODE_ENV ?? "development",
          NOTIFICATIONS_DRIVER: process.env.NOTIFICATIONS_DRIVER ?? "dummy",
          PORT: port,
        },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
