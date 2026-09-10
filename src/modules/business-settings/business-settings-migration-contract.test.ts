import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

/**
 * Contrato entre los defaults del dominio y la migración que crea la fila única.
 *
 * Si alguien cambia un valor por defecto en TypeScript y no toca la migración
 * (o al revés), el sitio público quedaría distinto según la base se haya creado
 * antes o después del cambio. Este test es el que lo impide.
 */

const repoRoot = path.resolve(__dirname, "../../..");

function readMigration(): string {
  const migrationsRoot = path.join(repoRoot, "prisma", "migrations");
  const directories = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_business_settings"))
    .map((entry) => entry.name);

  expect(directories).toHaveLength(1);
  return readFileSync(path.join(migrationsRoot, directories[0], "migration.sql"), "utf8");
}

/** Columnas del dominio con un valor por defecto distinto de `null`. */
function defaultColumns(): string[] {
  return Object.entries(DEFAULT_BUSINESS_SETTINGS as Record<string, unknown>)
    .filter(([key, value]) => key !== "businessHours" && value !== null)
    .map(([key]) => key);
}

function sqlLiteralFor(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

/** Columnas del `CREATE TABLE` que declaran un `DEFAULT`. */
function columnDefaults(sql: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  const pattern = /^\s*"(\w+)"\s+[A-Z ]+(?:\([^)]*\))?\s+(?:NOT NULL\s+)?DEFAULT\s+(.+?)\s*,?\s*$/gm;

  for (const match of sql.matchAll(pattern)) {
    defaults[match[1]] = match[2];
  }

  return defaults;
}

/** Corta una lista SQL por comas sin partir los literales entre comillas. */
function splitSqlList(text: string): string[] {
  const items: string[] = [];
  let current = "";
  let inString = false;

  for (const character of text) {
    if (character === "'") {
      inString = !inString;
      current += character;
      continue;
    }

    if (character === "," && !inString) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim().length > 0) items.push(current.trim());

  return items;
}

function parseSeedInsert(sql: string): Record<string, string> {
  const statement = /INSERT INTO "BusinessSettings"\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/.exec(
    sql,
  );

  expect(statement, "la migración tiene que sembrar la fila única").not.toBeNull();

  const columns = splitSqlList(statement![1]).map((column) => column.replace(/"/g, ""));
  const values = splitSqlList(statement![2]);

  expect(values).toHaveLength(columns.length);

  return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
}

describe("contrato de la migración de configuración del negocio", () => {
  it("declara en la tabla un DEFAULT compatible con los defaults del dominio", () => {
    const defaults = columnDefaults(readMigration());
    const columns = Object.keys(defaults);

    // Las columnas nullable no llevan DEFAULT en la tabla: su valor sale del
    // INSERT de la fila única, que se verifica en el test siguiente.
    expect(columns.length).toBeGreaterThan(0);

    for (const column of columns) {
      const expected = sqlLiteralFor((DEFAULT_BUSINESS_SETTINGS as Record<string, unknown>)[column]);

      expect(
        expected,
        `"${column}" tiene DEFAULT en la migración pero no existe en los defaults del dominio`,
      ).not.toBeNull();
      expect(defaults[column], `el DEFAULT de "${column}" quedó desincronizado`).toBe(expected);
    }
  });

  it("siembra la fila única con exactamente los defaults del dominio", () => {
    const inserted = parseSeedInsert(readMigration());

    expect(Object.keys(inserted).sort()).toEqual([...defaultColumns(), "businessHours", "updatedAt"].sort());

    for (const [column, value] of Object.entries(inserted)) {
      if (column === "updatedAt") {
        expect(value).toBe("NOW()");
        continue;
      }

      if (column === "businessHours") {
        const raw = value.replace(/^'/, "").replace(/'::jsonb$/, "");
        expect(raw).toBe(JSON.stringify(DEFAULT_BUSINESS_SETTINGS.businessHours));
        continue;
      }

      const expected = sqlLiteralFor((DEFAULT_BUSINESS_SETTINGS as Record<string, unknown>)[column]);
      expect(value, `la fila sembrada no coincide con el default de "${column}"`).toBe(expected);
    }
  });

  it("no pisa lo que el owner ya haya configurado si la fila existe", () => {
    expect(readMigration()).toContain('ON CONFLICT ("id") DO NOTHING');
  });
});
