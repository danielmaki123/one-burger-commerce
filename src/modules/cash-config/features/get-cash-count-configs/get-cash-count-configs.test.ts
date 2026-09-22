import { describe, expect, it } from "vitest";

import { InMemoryCashConfigRepository } from "@/modules/cash-config/adapters/in-memory-cash-config-repository";

import { getCashCountConfigs } from "./get-cash-count-configs";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — la config del conteo, por sucursal del alcance.
 *
 * Es lo que la pantalla de Caja usa para dibujar la grilla cuando cambia de local: cada sucursal tiene sus
 * monedas (el dólar es por local) y las denominaciones son del negocio.
 */
describe("getCashCountConfigs", () => {
  it("arma la config de cada sucursal con su moneda y las denominaciones activas", async () => {
    const repository = new InMemoryCashConfigRepository();
    await repository.saveLocationConfig("loc_norte", { usdEnabled: true });
    await repository.replaceDenominations([
      { currency: "NIO", value: 1000, isActive: true, sortOrder: 0 },
      { currency: "NIO", value: 500, isActive: false, sortOrder: 1 },
      { currency: "USD", value: 20, isActive: true, sortOrder: 0 },
    ]);

    const configs = await getCashCountConfigs(
      { locationIds: ["loc_norte", "loc_sur"], businessCurrencyCode: "NIO" },
      { repository },
    );

    // El local con dólares habilitados los cuenta; el otro no, aunque las filas existan.
    expect(configs.loc_norte.currencies).toEqual(["NIO", "USD"]);
    expect(configs.loc_sur.currencies).toEqual(["NIO"]);
    expect(configs.loc_norte.denominations.NIO).toEqual([1000]);
    expect(configs.loc_norte.denominations.USD).toEqual([20]);
    expect(configs.loc_sur.denominations.USD).toBeUndefined();
  });

  it("una sucursal sin fila ni config cae a los defaults (nunca se queda sin contar)", async () => {
    const repository = new InMemoryCashConfigRepository();

    const configs = await getCashCountConfigs(
      { locationIds: ["loc_nueva"], businessCurrencyCode: "NIO" },
      { repository },
    );

    expect(configs.loc_nueva.currencies).toEqual(["NIO"]);
    expect(configs.loc_nueva.denominations.NIO).toEqual([1000, 500, 200, 100, 50, 20, 10, 5, 1]);
  });
});
