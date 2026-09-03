const keys = ["DATABASE_URL", "NEXTAUTH_SECRET", "APP_ENV", "NODE_ENV"];

for (const key of keys) {
  const v = process.env[key];
  const status = !v ? "present_empty_or_missing" : "present_nonempty";
  console.log(`${key}=${status}`);
}
