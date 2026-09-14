import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TASK-104 — contrato de la migración de turnos.
 *
 * La regla "un solo turno abierto por local a la vez" **no se puede declarar en `schema.prisma`**:
 * el DSL de Prisma no tiene índices parciales. Vive en el SQL de la migración, así que si alguien
 * regenera la migración (o la edita) el índice puede desaparecer sin que nada avise, y entonces dos
 * cajas pueden abrir el mismo turno y el arqueo queda partido en dos. Este test es ese aviso.
 *
 * El comportamiento real del índice está verificado contra PostgreSQL: un segundo turno `open` en
 * el mismo local falla, un turno `closed` del mismo local pasa, y un turno `open` en otro local
 * pasa.
 */

const repoRoot = process.cwd();
const MIGRATION =
  "prisma/migrations/20260914140000_add_shift/migration.sql";

function migrationSql(): string {
  return readFileSync(join(repoRoot, MIGRATION), "utf8");
}

describe("contrato · migración del turno de caja (TASK-104)", () => {
  it("declara el índice único parcial que impide dos turnos abiertos en el mismo local", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/CREATE UNIQUE INDEX "Shift_one_open_per_location_key"/);
    // Parcial de verdad: la condición es lo que deja convivir el historial de turnos cerrados.
    expect(sql).toMatch(/WHERE "status" = 'open'/);
  });

  it("crea la tabla y el enum que el schema declara", () => {
    const sql = migrationSql();

    expect(sql).toContain(`CREATE TYPE "ShiftStatus" AS ENUM ('open', 'closed');`);
    expect(sql).toContain(`CREATE TABLE "Shift"`);
    expect(sql).toContain(`"status" "ShiftStatus" NOT NULL DEFAULT 'open'`);
    expect(sql).toContain(`"openingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0`);
  });

  it("es aditiva: no borra ni reescribe columnas de otras tablas", () => {
    const sql = migrationSql();

    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(sql).not.toMatch(/ALTER TABLE "(?!Shift)/i);
  });

  it("la migración no tiene BOM (rompe `migrate deploy` en una base nueva)", () => {
    const bytes = readFileSync(join(repoRoot, MIGRATION));

    expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
  });
});
