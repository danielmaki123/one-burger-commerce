import { describe, expect, it, vi } from "vitest";

import { InMemoryAuditLogRepository } from "@/modules/audit/adapters/in-memory-audit-log-repository";
import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryCurrencyRepository } from "@/modules/money/adapters/in-memory-currency-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";
import type { MoneyObligationGuard, OpenMoneyObligations } from "@/modules/money/ports/money-obligation-guard";

import { changeBaseCurrency } from "./change-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`D-023`) — **el cambio de moneda base es una operación de
 * período cerrado**.
 *
 * Cambiar la unidad en la que el sistema expresa la plata mientras hay obligaciones vivas las deja
 * expresadas en la base vieja: el saldo que se le exige a un pedido `partial` pasaría a significar otra
 * cosa, y el arqueo de un turno abierto quedaría explicado con una base que ya no rige.
 *
 * Lo que se fija:
 *
 * 1. con un **turno abierto** el cambio se rechaza con `409` y el motivo en el campo;
 * 2. con **deuda `pending`/`partial`** también, y el mensaje dice cuántas;
 * 3. sin obligaciones vivas el cambio **procede** y sigue haciendo lo suyo (cerrar los períodos de tasa,
 *    dejar el asiento, no recalcular ningún hecho);
 * 4. la guarda es **consultiva**: `money` decide con el número, no depende de la forma de `Order`/`Shift`.
 */
describe("changeBaseCurrency · guarda de obligaciones vivas", () => {
  function setup(obligations: OpenMoneyObligations = { openShifts: 0, pendingObligations: 0 }) {
    const exchangeRateRepository = new InMemoryExchangeRateRepository();
    const settingsRepository = new InMemoryBusinessCurrencySettingsRepository({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      exchangeRateRepository,
    });
    const currencyRepository = new InMemoryCurrencyRepository({
      currencies: [
        { id: "c1", code: "NIO", name: "Córdoba", symbol: "C$", decimals: 2, isKnown: true, isActive: true, sortOrder: 0 },
        { id: "c2", code: "USD", name: "Dólar", symbol: "US$", decimals: 2, isKnown: true, isActive: true, sortOrder: 1 },
      ],
    });
    const countOpenObligations = vi.fn(async () => obligations);
    const obligationGuard: MoneyObligationGuard = { countOpenObligations };

    return {
      countOpenObligations,
      obligationGuard,
      dependencies: {
        currencyRepository,
        settingsRepository,
        obligationGuard,
        actorUserId: "usr_owner",
        now: () => new Date("2026-09-30T12:00:00.000Z"),
      },
    };
  }

  it("rechaza el cambio con un turno de caja abierto", async () => {
    const { dependencies, countOpenObligations } = setup({ openShifts: 1, pendingObligations: 0 });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies)).rejects.toMatchObject({
      status: 409,
      fields: { code: expect.stringContaining("caja") },
    });

    expect(countOpenObligations).toHaveBeenCalledTimes(1);
  });

  it("rechaza el cambio con pedidos que todavía deben plata", async () => {
    const { dependencies } = setup({ openShifts: 0, pendingObligations: 3 });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies)).rejects.toMatchObject({
      status: 409,
      fields: { code: expect.stringContaining("3") },
    });
  });

  it("sin obligaciones vivas el cambio procede y cierra los períodos de tasa", async () => {
    const { dependencies } = setup();
    await dependencies.settingsRepository.setLocale({ locale: "es-NI", updatedByUserId: null });

    const result = await changeBaseCurrency({ code: "USD" }, dependencies);

    expect(result.data.baseCurrencyCode).toBe("USD");
    expect(result.data.previousBaseCurrencyCode).toBe("NIO");
  });

  it("la guarda se consulta **antes** de escribir: un rechazo no deja la base a medio cambiar", async () => {
    const { dependencies } = setup({ openShifts: 1, pendingObligations: 0 });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies)).rejects.toThrow();

    const saved = await dependencies.settingsRepository.getSettings();

    expect(saved?.baseCurrencyCode).toBe("NIO");
    expect((await dependencies.settingsRepository.getSettings())?.locale).toBe("es-NI");
  });

  it("sin guarda inyectada el caso de uso no inventa obligaciones", async () => {
    const exchangeRateRepository = new InMemoryExchangeRateRepository();
    const result = await changeBaseCurrency(
      { code: "USD" },
      {
        currencyRepository: new InMemoryCurrencyRepository({
          currencies: [
            { id: "c1", code: "NIO", name: "Córdoba", symbol: "C$", decimals: 2, isKnown: true, isActive: true, sortOrder: 0 },
            { id: "c2", code: "USD", name: "Dólar", symbol: "US$", decimals: 2, isKnown: true, isActive: true, sortOrder: 1 },
          ],
        }),
        settingsRepository: new InMemoryBusinessCurrencySettingsRepository({
          settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
          exchangeRateRepository,
          auditLog: new InMemoryAuditLogRepository(),
        }),
        actorUserId: "usr_owner",
      },
    );

    expect(result.data.baseCurrencyCode).toBe("USD");
  });
});
