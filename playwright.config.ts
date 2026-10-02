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
  /**
   * `TASK-ORDER-POS-OPERATIONAL-006` — **presupuesto de `expect` explícito**.
   *
   * El default de Playwright es 5 s. El panel verifica la contraseña con bcrypt y **rehashea** en el primer
   * login de una cuenta: con la suite entera en paralelo, la sesión tardaba más que eso y los casos de rol
   * fallaban por reloj (`toHaveURL` en `/admin/login`), no por comportamiento —los mismos specs pasan solos y
   * fallaban cuatro distintos por corrida—. Subir el techo no baja ninguna expectativa: un caso que de verdad
   * no llega sigue fallando, sólo tarda más en decirlo.
   */
  expect: { timeout: 20_000 },
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
          // La suite entra al admin varias veces por corrida; con el límite de
          // producción (10/min por IP) dos corridas seguidas se pisan y el test del
          // manager falla por rate limit, no por permisos.
          ADMIN_LOGIN_RATE_LIMIT: process.env.ADMIN_LOGIN_RATE_LIMIT ?? "200",
          PORT: port,
        },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
