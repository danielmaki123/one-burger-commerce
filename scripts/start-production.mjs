import { spawnSync } from "node:child_process";

const maxAttempts = Number(process.env.MIGRATION_MAX_ATTEMPTS || 12);
const retryDelayMs = Number(process.env.MIGRATION_RETRY_DELAY_MS || 5000);

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`Running database migrations (${attempt}/${maxAttempts})...`);
  const result = run("npx", ["prisma", "migrate", "deploy"]);

  if (result.status === 0) {
    console.log("Database migrations completed.");
    const startResult = run("npm", ["run", "start"]);
    process.exit(startResult.status ?? 1);
  }

  if (attempt === maxAttempts) {
    console.error("Database migrations failed after all retry attempts.");
    process.exit(result.status ?? 1);
  }

  console.warn(`Database migration failed; retrying in ${retryDelayMs}ms.`);
  sleep(retryDelayMs);
}
