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
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required runtime environment variables: ${missing.join(", ")}. ` +
        "Refusing to start because the app would serve broken routes.",
    );
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "production") {
    console.error(
      `NODE_ENV must be "production" in this entrypoint (received "${nodeEnv}"). ` +
        "Cookies would not be marked secure.",
    );
    process.exit(1);
  }

  // Staging-only safety valves must never be active in a production container:
  // with them on, OTP codes are written to the logs in clear text.
  if (
    process.env.CUSTOMER_OTP_DEV_LOG === "true" ||
    process.env.CUSTOMER_OTP_STAGING_SMOKE_MODE === "true"
  ) {
    console.error(
      "CUSTOMER_OTP_DEV_LOG/CUSTOMER_OTP_STAGING_SMOKE_MODE are staging-only " +
        "debug switches and must not be enabled in production.",
    );
    process.exit(1);
  }

  if (process.env.APP_ENV !== "production") {
    console.warn(
      `[startup] APP_ENV="${process.env.APP_ENV}" is not "production". ` +
        "Staging-only internal endpoints stay enabled with this value.",
    );
  }

  console.log(
    `[startup] environment ok (APP_ENV=${process.env.APP_ENV}, migrations ${
      migrationsAuto ? "automatic" : "skipped (MIGRATIONS_AUTO=false)"
    })`,
  );
}

function startServer() {
  const startResult = run("npm", ["run", "start"]);
  process.exit(startResult.status ?? 1);
}

validateEnvironment();

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
