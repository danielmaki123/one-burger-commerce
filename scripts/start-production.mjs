import { spawnSync } from "node:child_process";

const requiredKeys = ["DATABASE_URL", "DIRECT_URL", "APP_ENV", "NODE_ENV"];
const maxAttempts = Number(process.env.MIGRATION_MAX_ATTEMPTS || 12);
const retryDelayMs = Number(process.env.MIGRATION_RETRY_DELAY_MS || 5000);
const migrationsAuto = (process.env.MIGRATIONS_AUTO ?? "true") !== "false";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function validateEnvironment() {
  const problems = [];
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    problems.push(
      `Missing required runtime environment variables: ${missing.join(", ")}. ` +
        "Refusing to start because the app would serve broken routes.",
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "production") {
    problems.push(
      `NODE_ENV must be "production" in this entrypoint (received "${nodeEnv}"). ` +
        "Cookies would not be marked secure.",
    );
  }

  /**
   * TASK-AUD-007 — `APP_ENV` es una frontera de seguridad, no una etiqueta: con cualquier valor distinto de
   * `production` los endpoints internos de staging (`/api/internal/staging/**`) dejan de estar cerrados, y
   * esos crean administradores y corren seeds. Antes este caso solo se avisaba por consola y el contenedor
   * arrancaba igual: un entorno de producción a medio configurar se degradaba en silencio.
   *
   * Este contenedor **es** el de producción, así que no se arranca. Un staging de verdad se corre con otro
   * entrypoint (`next start` con su `APP_ENV`), no relajando esta comprobación.
   */
  const appEnv = process.env.APP_ENV;
  if (appEnv !== "production") {
    problems.push(
      `APP_ENV must be "production" in this entrypoint (received "${appEnv}"). ` +
        "With any other value the staging-only internal endpoints stay reachable, and those " +
        "create admins and run seeds. If you need a staging environment, run it with another " +
        "entrypoint instead of relaxing this check.",
    );
  }

  // Staging-only safety valves must never be active in a production container:
  // with them on, OTP codes are written to the logs in clear text.
  if (
    process.env.CUSTOMER_OTP_DEV_LOG === "true" ||
    process.env.CUSTOMER_OTP_STAGING_SMOKE_MODE === "true"
  ) {
    problems.push(
      "CUSTOMER_OTP_DEV_LOG/CUSTOMER_OTP_STAGING_SMOKE_MODE are staging-only " +
        "debug switches and must not be enabled in production.",
    );
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[startup] ${problem}`);
    }

    console.error("[startup] refusing to start with a broken production environment.");

    return false;
  }

  console.log(
    `[startup] environment ok (APP_ENV=${appEnv}, migrations ${
      migrationsAuto ? "automatic" : "skipped (MIGRATIONS_AUTO=false)"
    })`,
  );

  return true;
}

/**
 * One-shot first-admin creation, used only when the operator sets
 * `BOOTSTRAP_ADMIN_ON_START=true` together with the BOOTSTRAP_ADMIN_* values.
 * It runs after migrations (the AdminUser table has to exist) and never logs the
 * password. Remove the flag afterwards: the account persists on its own.
 */
function bootstrapAdminIfRequested() {
  if (process.env.BOOTSTRAP_ADMIN_ON_START !== "true") {
    return;
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  if (!email || !process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.warn(
      "[startup] BOOTSTRAP_ADMIN_ON_START=true but BOOTSTRAP_ADMIN_EMAIL/PASSWORD are missing; skipping.",
    );
    return;
  }

  console.log(`[startup] creating/updating the initial admin ${email}...`);
  const result = run("npx", ["tsx", "scripts/bootstrap-admin.ts"]);

  if (result.status !== 0) {
    console.error("[startup] initial admin bootstrap failed.");
    process.exit(result.status ?? 1);
  }

  console.warn(
    "[startup] initial admin ready. Remove BOOTSTRAP_ADMIN_ON_START and the BOOTSTRAP_ADMIN_* variables from the service and redeploy.",
  );
}

function startServer() {
  bootstrapAdminIfRequested();
  const startResult = run("npm", ["run", "start"]);
  process.exit(startResult.status ?? 1);
}

const environmentOk = validateEnvironment();

/**
 * TASK-AUD-007 — modo de **solo validación**: comprueba el entorno y sale sin migrar ni levantar el
 * servidor. Lo usa el contrato `production-environment-contract.test.ts` para probar este mismo entrypoint
 * (y sirve para un preflight sin arrancar la app).
 */
if (process.env.START_PRODUCTION_VALIDATE_ONLY === "true") {
  console.log("[startup] validate-only: not running migrations nor starting the server.");
  process.exit(environmentOk ? 0 : 1);
}

if (!environmentOk) {
  process.exit(1);
}

if (!migrationsAuto) {
  console.warn(
    "[startup] MIGRATIONS_AUTO=false: skipping `prisma migrate deploy`. " +
      "Run migrations as an explicit step before rolling out.",
  );
  startServer();
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`Running database migrations (${attempt}/${maxAttempts})...`);
  const result = run("npx", ["prisma", "migrate", "deploy"]);

  if (result.status === 0) {
    console.log("Database migrations completed.");
    startServer();
  }

  if (attempt === maxAttempts) {
    console.error("Database migrations failed after all retry attempts.");
    process.exit(result.status ?? 1);
  }

  console.warn(`Database migration failed; retrying in ${retryDelayMs}ms.`);
  sleep(retryDelayMs);
}
