import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TASK-AUD-007 — el entrypoint de producción **fail-closed**.
 *
 * El contenedor de producción se levanta con `npm run start:production`
 * (`scripts/start-production.mjs`, el `CMD` de la imagen). Ese script ya exigía las variables críticas y
 * prohibía los interruptores de staging que escriben OTP en claro, pero con un `APP_ENV` distinto de
 * `production` **solo avisaba por consola y seguía arrancando**: en ese entorno los endpoints internos de
 * staging (`/api/internal/staging/**`, que crean admins y corren seeds) dejan de estar cerrados. Es
 * exactamente el caso «un entorno de producción a medio configurar se degrada en silencio».
 *
 * Este contrato corre el **entrypoint real** con `START_PRODUCTION_VALIDATE_ONLY=true` (valida y sale, sin
 * migrar ni levantar el servidor) y fija las dos mitades: lo que tiene que abortar y lo que tiene que pasar.
 * La `DATABASE_URL` de las pruebas es **inválida a propósito** (un puerto que no existe): aunque el flag
 * faltara, el peor caso es que falle al conectar y nunca toque una base real.
 */

const SCRIPT = path.resolve(__dirname, "../../../scripts/start-production.mjs");

/**
 * La base de las pruebas **no lleva credenciales a propósito**: al escáner de secretos del repo
 * (`npm run security:secrets`) una URL de Postgres con usuario y contraseña embebidos le da un positivo, y
 * acá no hacen falta — el modo de solo validación no migra, y si algún día migrara, este puerto no existe.
 */
const UNREACHABLE_DATABASE_URL = "postgresql://127.0.0.1:1/ninguna?schema=public";

const baseEnvironment = {
  PATH: process.env.PATH,
  START_PRODUCTION_VALIDATE_ONLY: "true",
  DATABASE_URL: UNREACHABLE_DATABASE_URL,
  DIRECT_URL: UNREACHABLE_DATABASE_URL,
  APP_ENV: "production",
  NODE_ENV: "production",
  MIGRATION_MAX_ATTEMPTS: "1",
  MIGRATION_RETRY_DELAY_MS: "10",
};

function runEntrypoint(overrides: Record<string, string | undefined>): {
  status: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      env: { ...baseEnvironment, ...overrides } as NodeJS.ProcessEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };

    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

describe("contrato · el arranque de producción es fail-closed", () => {
  it("un entorno completo y de producción pasa la validación", () => {
    const result = runEntrypoint({});

    expect(result.status, `el arranque falló: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("environment ok");
  });

  it("APP_ENV distinto de production NO arranca (los endpoints de staging quedarían abiertos)", () => {
    const result = runEntrypoint({ APP_ENV: "staging" });

    expect(result.status, "arrancó con APP_ENV=staging: el fail-closed no existe").not.toBe(0);
    expect(result.stderr).toContain("APP_ENV");
    expect(result.stdout).not.toContain("environment ok");
  });

  it("NODE_ENV distinto de production NO arranca (las cookies no irían con secure)", () => {
    const result = runEntrypoint({ NODE_ENV: "development" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("NODE_ENV");
  });

  it("una variable crítica que falta NO arranca", () => {
    const result = runEntrypoint({ DATABASE_URL: undefined });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DATABASE_URL");
  });

  it("un interruptor de staging que escribe OTP en claro NO arranca", () => {
    const result = runEntrypoint({ CUSTOMER_OTP_DEV_LOG: "true" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("CUSTOMER_OTP_DEV_LOG");
  });
});
