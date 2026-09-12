import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";

/**
 * Contrato de la migración de locales (T8).
 *
 * Una migración de datos que crea el local primario y backfillea los pedidos no se puede
 * probar con un unitario: lo que sí se puede fijar es que el SQL **exista y diga lo que
 * tiene que decir**. Los tres puntos que importan:
 *
 *  1. el local primario hereda la operación de `BusinessSettings` y se crea **siempre**,
 *     incluso en una base nueva sin configuración (si no, el negocio queda sin local y no
 *     se puede pedir);
 *  2. `Order.locationId` se agrega en tres pasos (nullable → backfill → NOT NULL), porque
 *     agregarla directo como obligatoria falla con los pedidos que ya existen;
 *  3. sin BOM, que es lo que rompe `prisma migrate deploy` en cualquier base nueva.
 */

const repoRoot = path.resolve(__dirname, "../../..");

function readMigration(): string {
  const migrationsRoot = path.join(repoRoot, "prisma", "migrations");
  const directories = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_locations"))
    .map((entry) => entry.name);

  expect(directories).toHaveLength(1);
  return readFileSync(path.join(migrationsRoot, directories[0], "migration.sql"), "utf8");
}

describe("migración add_locations", () => {
  const sql = readMigration();

  it("no tiene BOM", () => {
    const bytes = readFileSync(
      path.join(
        repoRoot,
        "prisma",
        "migrations",
        readdirSync(path.join(repoRoot, "prisma", "migrations"), { withFileTypes: true }).find(
          (entry) => entry.isDirectory() && entry.name.endsWith("_add_locations"),
        )!.name,
        "migration.sql",
      ),
    );

    expect(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf).toBe(false);
  });

  it("crea las dos tablas nuevas", () => {
    expect(sql).toContain('CREATE TABLE "Location"');
    expect(sql).toContain('CREATE TABLE "LocationProduct"');
    // El precio es opcional: sin override vale el precio base del producto.
    expect(sql).toContain('"priceOverride" DECIMAL(10,2)');
    expect(sql).toContain('CREATE UNIQUE INDEX "LocationProduct_locationId_productId_key"');
  });

  it("crea el local primario copiando la operación configurada", () => {
    expect(sql).toContain("'loc_principal'");
    expect(sql).toContain('FROM (SELECT 1) AS seed');
    expect(sql).toContain('LEFT JOIN "BusinessSettings" bs');
    expect(sql).toContain('bs."pickupLeadMinutes"');
    expect(sql).toContain('bs."isAcceptingOrders"');
    expect(sql).toContain('bs."addressLine"');
  });

  it("el horario por defecto del SQL es el mismo del dominio", () => {
    // Si alguien cambia `DEFAULT_BUSINESS_HOURS`, el respaldo de la migración tiene que
    // moverse con él o una base nueva arrancaría con otro horario.
    for (const day of Object.values(DEFAULT_BUSINESS_HOURS)) {
      expect(sql).toContain(`"open":"${day.open}","close":"${day.close}"`);
    }
  });

  it("agrega locationId en tres pasos y lo deja obligatorio", () => {
    const addColumn = sql.indexOf('ALTER TABLE "Order" ADD COLUMN "locationId" TEXT;');
    const backfill = sql.indexOf('UPDATE "Order" SET "locationId" = \'loc_principal\'');
    const notNull = sql.indexOf('ALTER TABLE "Order" ALTER COLUMN "locationId" SET NOT NULL;');

    expect(addColumn).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(addColumn);
    expect(notNull).toBeGreaterThan(backfill);
    // La columna NO se agrega directo como NOT NULL: eso falla con pedidos existentes.
    expect(sql).not.toContain('ADD COLUMN "locationId" TEXT NOT NULL');
    expect(sql).toContain('CREATE INDEX "Order_locationId_idx"');
  });
});
