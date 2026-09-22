import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CASH_DENOMINATIONS,
  DEFAULT_LOCATION_CASH_CONFIG,
} from "@/modules/cash-config/domain/cash-config-defaults";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — contrato entre los defaults del dominio y la migración.
 *
 * Dos cosas que no pueden desincronizarse:
 *
 * 1. **Los billetes sembrados**: la migración `add_cash_config` inserta las denominaciones de fábrica. Si
 *    alguien cambia `DEFAULT_CASH_DENOMINATIONS` y no la migración (o al revés), una base nueva y otra ya
 *    migrada contarían con billetes distintos.
 * 2. **Los flags de la config por sucursal**: el `DEFAULT` del `CREATE TABLE` tiene que ser el mismo que
 *    el del dominio, o una sucursal sin fila se comportaría distinto según cómo se creó.
 *
 * Es el mismo patrón que `business-settings-migration-contract.test.ts` (que ya custodia el caso hermano).
 */

const repoRoot = path.resolve(__dirname, "../../..");

function readMigration(): string {
  const migrationsRoot = path.join(repoRoot, "prisma", "migrations");
  const directories = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_cash_config"))
    .map((entry) => entry.name);

  expect(directories).toHaveLength(1);
  return readFileSync(path.join(migrationsRoot, directories[0], "migration.sql"), "utf8");
}

/** Las filas del `INSERT INTO "CashDenomination"`, como `NIO-1000`. */
function seededDenominations(sql: string): string[] {
  const insert = sql.match(/INSERT INTO "CashDenomination"[\s\S]*?;/);

  expect(insert, "la migración siembra las denominaciones").toBeTruthy();

  return [...insert![0].matchAll(/\('den_(\w+?)_(\d+)',\s*'(\w+)',\s*([\d.]+)/g)].map(
    ([, , , currency, value]) => `${currency}-${Number(value)}`,
  );
}

/** Las denominaciones de fábrica, como `NIO-1000`. */
function defaultDenominations(): string[] {
  return Object.entries(DEFAULT_CASH_DENOMINATIONS).flatMap(([currency, values]) =>
    values.map((value) => `${currency}-${value}`),
  );
}

describe("contrato · migración de la configuración de caja", () => {
  it("siembra exactamente los billetes de los defaults del dominio", () => {
    expect(seededDenominations(readMigration()).sort()).toEqual(defaultDenominations().sort());
  });

  it("los flags de una sucursal sin fila son los del dominio", () => {
    const sql = readMigration();
    const table = sql.match(/CREATE TABLE "LocationCashConfig"[\s\S]*?\);/);

    expect(table, "la migración crea la tabla de config").toBeTruthy();

    const usdDefault = /"usdEnabled"\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+(true|false)/.exec(table![0]);
    const blindDefault = /"blindCount"\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+(true|false)/.exec(table![0]);

    expect(usdDefault?.[1]).toBe(String(DEFAULT_LOCATION_CASH_CONFIG.usdEnabled));
    expect(blindDefault?.[1]).toBe(String(DEFAULT_LOCATION_CASH_CONFIG.blindCount));
  });

  it("la migración no trae BOM (rompe `prisma migrate deploy` en una base nueva)", () => {
    const bytes = readFileSync(
      path.join(
        repoRoot,
        "prisma",
        "migrations",
        readdirSync(path.join(repoRoot, "prisma", "migrations")).find((name) =>
          name.endsWith("_add_cash_config"),
        )!,
        "migration.sql",
      ),
    );

    expect(bytes[0]).not.toBe(0xef);
  });
});
