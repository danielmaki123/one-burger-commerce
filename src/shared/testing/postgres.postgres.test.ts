import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";

import { closeDatabase, databaseUrl, resetDatabase } from "./postgres";

/**
 * TASK-AUD-004 — el arnés de PostgreSQL real, probado.
 *
 * Un arnés sin test es una promesa: si `resetDatabase` no vacía lo que dice, los tests de atomicidad
 * empiezan a medir basura y pasan o fallan por el motivo equivocado. Acá se fija lo mínimo: hay base,
 * hay migraciones aplicadas y el reseteo deja el esquema vacío de verdad.
 */

describe("arnés · PostgreSQL real", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("hay una base configurada (si falta, el arnés lo dice en vez de saltearse)", () => {
    expect(databaseUrl()).toMatch(/^postgres(ql)?:\/\//);
  });

  it("las migraciones están aplicadas: las tablas del dominio existen", async () => {
    const prisma = getPrismaClient();

    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;

    const tables = rows.map((row) => row.tablename);

    expect(tables).toContain("Order");
    expect(tables).toContain("Payment");
    expect(tables).toContain("Shift");
    expect(tables).toContain("ShiftCashCount");
    expect(tables).toContain("ShiftBankClose");
  });

  it("el reseteo deja el esquema vacío y no borra la historia de migraciones", async () => {
    const prisma = getPrismaClient();

    await prisma.location.create({
      data: {
        id: "loc_arnes",
        name: "Local del arnés",
        slug: "local-del-arnes",
        businessHours: [],
      },
    });

    expect(await prisma.location.count()).toBe(1);

    await resetDatabase();

    expect(await prisma.location.count()).toBe(0);

    const applied = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
    `;

    expect(Number(applied[0].count)).toBeGreaterThan(0);
  });
});
