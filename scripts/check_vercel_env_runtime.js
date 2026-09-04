const strictProduction = process.argv.includes("--strict-production");
const isVercelProduction = process.env.VERCEL_ENV === "production";
const requiredProductionKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "APP_ENV",
];
const keys = Array.from(
  new Set([...requiredProductionKeys, "NODE_ENV", "NOTIFICATIONS_DRIVER"]),
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

if (strictProduction && isVercelProduction && missing.length > 0) {
  console.error(
    `Missing required production environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}
