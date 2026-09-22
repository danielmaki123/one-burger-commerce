import { describe, expect, it } from "vitest";

import { InMemoryCashConfigRepository } from "@/modules/cash-config/adapters/in-memory-cash-config-repository";
import type { CashDenominationRecord } from "@/modules/cash-config/domain/cash-config.types";

import { updateCashConfig } from "./update-cash-config";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — guardar la config de una sucursal.
 *
 * Lo que fijan estos casos:
 *
 * - Los flags se guardan con **auditoría** (`updatedAt` + `updatedByUserId`): decisión del owner.
 * - Las denominaciones se reemplazan enteras, ordenadas de mayor a menor, y **una que sale de la lista se
 *   desactiva, no se borra** (los cierres viejos siguen diciendo con qué billetes se contó).
 * - No se puede dejar la caja **sin ningún billete activo**.
 * - Un guardado puede traer solo una parte: lo que no vino, no se toca.
 */

const nio = (value: number, isActive = true, sortOrder = 0): CashDenominationRecord => ({
  currency: "NIO",
  value,
  isActive,
  sortOrder,
});

describe("updateCashConfig", () => {
  it("prende los dólares y deja la auditoría de quién lo hizo", async () => {
    const repository = new InMemoryCashConfigRepository();

    const config = await updateCashConfig(
      { locationId: "loc_norte", usdEnabled: true },
      { repository, updatedByUserId: "user_owner" },
    );

    expect(config.usdEnabled).toBe(true);
    expect(config.blindCount).toBe(true);
    expect(config.updatedByUserId).toBe("user_owner");
    expect(config.updatedAt).not.toBeNull();
  });

  it("reemplaza las denominaciones y ordena de mayor a menor", async () => {
    const repository = new InMemoryCashConfigRepository();

    const config = await updateCashConfig(
      {
        locationId: "loc_norte",
        denominations: [nio(100), nio(1000), { currency: "USD", value: 20, isActive: true, sortOrder: 0 }],
      },
      { repository },
    );

    expect(config.denominations.map((row) => `${row.currency}-${row.value}`)).toEqual([
      "NIO-1000",
      "NIO-100",
      "USD-20",
    ]);
    expect(config.denominations[0].sortOrder).toBe(0);
  });

  it("una denominación que sale de la lista se desactiva, no se borra", async () => {
    const repository = new InMemoryCashConfigRepository();

    await updateCashConfig(
      { locationId: "loc_norte", denominations: [nio(1000), nio(500)] },
      { repository },
    );
    const config = await updateCashConfig(
      { locationId: "loc_norte", denominations: [nio(1000)] },
      { repository },
    );

    expect(config.denominations).toHaveLength(2);
    expect(config.denominations.find((row) => row.value === 500)?.isActive).toBe(false);
  });

  it("no deja la caja sin ningún billete activo", async () => {
    const repository = new InMemoryCashConfigRepository();

    await expect(
      updateCashConfig(
        { locationId: "loc_norte", denominations: [nio(1000, false), nio(500, false)] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      fields: { denominations: expect.stringContaining("activo") },
    });
  });

  it("rechaza la misma denominación dos veces con un mensaje que la nombra", async () => {
    const repository = new InMemoryCashConfigRepository();

    await expect(
      updateCashConfig(
        { locationId: "loc_norte", denominations: [nio(1000), nio(1000)] },
        { repository },
      ),
    ).rejects.toMatchObject({ fields: { denominations: expect.stringContaining("NIO 1000") } });
  });

  it("un flag sin denominaciones no toca los billetes", async () => {
    const repository = new InMemoryCashConfigRepository();

    await updateCashConfig(
      { locationId: "loc_norte", denominations: [nio(1000)] },
      { repository },
    );
    const config = await updateCashConfig(
      { locationId: "loc_norte", blindCount: false },
      { repository },
    );

    expect(config.blindCount).toBe(false);
    expect(config.denominations).toHaveLength(1);
  });
});
