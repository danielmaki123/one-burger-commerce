import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("deploy runtime contract", () => {
  it("keeps every migration free of a UTF-8 BOM so PostgreSQL can parse it", () => {
    const migrationsRoot = path.join(repoRoot, "prisma", "migrations");
    const migrationFiles = readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        path.join(migrationsRoot, entry.name, "migration.sql"),
      );

    expect(migrationFiles.length).toBeGreaterThan(0);

    for (const migrationFile of migrationFiles) {
      const bytes = readFileSync(migrationFile);

      // 0xEF 0xBB 0xBF at offset 0 makes Postgres fail with
      // `syntax error at or near "\u{feff}"` on every fresh database.
      const hasBom =
        bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf;

      expect(hasBom, `${migrationFile} starts with a UTF-8 BOM`).toBe(false);
    }
  });

  it("copies public assets into the runtime image so the PWA files are served", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("COPY --from=builder /app/public ./public");
  });

  it("injects APP_BUILD_VERSION during the image build instead of falling back to dev", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toMatch(/APP_BUILD_VERSION=/);
  });

  it("copies the production entrypoint script into the runtime image", () => {
    const dockerfile = readRepoFile("Dockerfile");
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const entrypoint = packageJson.scripts["start:production"];

    // `npm run start:production` runs a file from scripts/, so the runner stage
    // must ship that directory or the container dies with MODULE_NOT_FOUND.
    expect(entrypoint).toContain("scripts/");
    expect(dockerfile).toContain("COPY --from=builder /app/scripts ./scripts");
  });

  it("healthchecks the readiness route so an unreachable database is unhealthy", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/api/readiness");
    expect(dockerfile).not.toContain("/api/health'");
  });

  it("fails fast when required runtime variables are missing", () => {
    const startScript = readRepoFile("scripts/start-production.mjs");

    for (const key of ["DATABASE_URL", "DIRECT_URL", "APP_ENV", "NODE_ENV"]) {
      expect(startScript).toContain(key);
    }

    expect(startScript).toContain("process.exit(1)");
    expect(startScript).toContain("MIGRATIONS_AUTO");
  });

  it("refuses to start with staging-only OTP debug switches enabled", () => {
    const startScript = readRepoFile("scripts/start-production.mjs");

    expect(startScript).toContain("CUSTOMER_OTP_DEV_LOG");
    expect(startScript).toContain("CUSTOMER_OTP_STAGING_SMOKE_MODE");
  });

  it("verifies the build before publishing a production image", () => {
    const workflow = readRepoFile(".github/workflows/publish-ghcr.yml");

    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("prisma migrate deploy");
    expect(workflow).toContain("prisma migrate diff");
    expect(workflow).toMatch(/publish:[\s\S]*needs:[\s\S]*verify/);
  });

  it("ships security headers for every response", () => {
    const nextConfig = readRepoFile("next.config.ts");

    expect(nextConfig).toContain("poweredByHeader: false");
    expect(nextConfig).toContain("Strict-Transport-Security");
    expect(nextConfig).toContain("X-Content-Type-Options");
    expect(nextConfig).toContain("X-Frame-Options");
    expect(nextConfig).toContain("Referrer-Policy");
  });
});
