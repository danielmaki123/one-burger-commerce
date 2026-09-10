/**
 * Build-time environment guard.
 *
 * Image builds (Docker/Easypanel) run without runtime secrets, so this check
 * only fails when the build itself declares a production environment and the
 * database variables are missing. Fail-fast for the running container lives in
 * `scripts/start-production.mjs`.
 */
const strictProduction = process.argv.includes("--strict-production");
const appEnv = process.env.APP_ENV;
const isProductionBuild =
  appEnv === "production" || process.env.VERCEL_ENV === "production";
const requiredProductionKeys = ["DATABASE_URL", "DIRECT_URL", "APP_ENV"];
const keys = Array.from(
  new Set([
    ...requiredProductionKeys,
    "NODE_ENV",
    "NOTIFICATIONS_DRIVER",
    "OUTBOX_PROCESSOR_ENABLED",
  ]),
);
const missing = [];

for (const key of keys) {
  const value = process.env[key];
  const status = !value ? "present_empty_or_missing" : "present_nonempty";
  console.log(`${key}=${status}`);

  if (requiredProductionKeys.includes(key) && !value) {
    missing.push(key);
  }
}

// Staging-only debug switches would print OTP codes in clear text.
const otpDebugFlags = [
  "CUSTOMER_OTP_DEV_LOG",
  "CUSTOMER_OTP_STAGING_SMOKE_MODE",
].filter((key) => process.env[key] === "true");

if (otpDebugFlags.length > 0 && appEnv === "production") {
  console.error(
    `Staging-only OTP debug switches must not be enabled with APP_ENV=production: ${otpDebugFlags.join(", ")}`,
  );
  process.exit(1);
}

if (strictProduction && isProductionBuild && missing.length > 0) {
  console.error(
    `Missing required production environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

if (strictProduction && !isProductionBuild) {
  console.log(
    "APP_ENV/VERCEL_ENV do not declare production: runtime variables are validated at container startup instead.",
  );
}
