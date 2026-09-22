import { describe, expect, it } from "vitest";

import { InMemoryCashConfigRepository } from "@/modules/cash-config/adapters/in-memory-cash-config-repository";

import { getCashConfig } from "./get-cash-config";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — leer la config de una sucursal.
 *
 * Una sucursal **sin fila** devuelve los valores de fábrica (sin dólares, arqueo ciego): la pantalla de
 * config se puede abrir en un local recién creado y la Caja tiene con qué dibujar el conteo.
 */
describe("getCashConfig", () => {
  it("una sucursal sin fila devuelve los valores de fábrica", async () => {
    const repository = new InMemoryCashConfigRepository();

    const config = await getCashConfig({ locationId: "loc_norte" }, { repository });

    expect(config).toMatchObject({
      locationId: "loc_norte",
      usdEnabled: false,
      blindCount: true,
      updatedAt: null,
      updatedByUserId: null,
    });
  });

  it("sin sucursal no inventa una config", async () => {
    const repository = new InMemoryCashConfigRepository();

    await expect(getCashConfig({ locationId: "  " }, { repository })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("devuelve lo guardado cuando la sucursal ya tiene fila", async () => {
    const repository = new InMemoryCashConfigRepository();
    await repository.saveLocationConfig("loc_norte", { usdEnabled: true, blindCount: false }, {
      updatedByUserId: "user_owner",
    });

    const config = await getCashConfig({ locationId: "loc_norte" }, { repository });

    expect(config.usdEnabled).toBe(true);
    expect(config.blindCount).toBe(false);
    expect(config.updatedByUserId).toBe("user_owner");
  });
});
