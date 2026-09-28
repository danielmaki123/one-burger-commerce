import { describe, expect, it } from "vitest";

import { InMemoryAuditLogRepository } from "@/modules/audit/adapters/in-memory-audit-log-repository";
import type { AuditLogRepository } from "@/modules/audit/ports/audit-log-repository";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryCurrencyRepository } from "@/modules/money/adapters/in-memory-currency-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";
import { currencyRecord, exchangeRateRecord } from "@/shared/testing/money-fixtures";

import { changeBaseCurrency } from "./change-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-80`) — **cambiar la moneda base**.
 *
 * Es una operación **explícita y auditada**, no un campo de texto:
 *
 * 1. la moneda tiene que existir y estar activa —una base apagada dejaría al negocio sin moneda—;
 * 2. **no recalcula nada**: el hecho histórico conserva su moneda, su tasa y su equivalente (ley 7). Por
 *    eso el caso de uso ni siquiera recibe `Payment`, `Refund`, `Shift` ni `Invoice`;
 * 3. los períodos de tasa que apuntaban a la base anterior se **cierran**, sin reescribir su tasa: siguen
 *    explicando el pasado, dejan de estar vigentes;
 * 4. queda el asiento con **de/para**.
 */
const NOW = "2026-09-28T12:00:00.000Z";

function dependencies(input: {
  baseCurrencyCode?: string;
  currencies?: ReturnType<typeof currencyRecord>[];
  rates?: ReturnType<typeof exchangeRateRecord>[];
  /** Un log que falla, para probar que la fila y el asiento son **una sola unidad**. */
  auditLog?: AuditLogRepository;
}) {
  const auditLog = input.auditLog ?? new InMemoryAuditLogRepository();
  const currencyRepository = new InMemoryCurrencyRepository({
    currencies: input.currencies ?? [],
  });
  const exchangeRateRepository = new InMemoryExchangeRateRepository({
    rates: input.rates ?? [],
    auditLog,
  });
  const settingsRepository = new InMemoryBusinessCurrencySettingsRepository({
    settings: {
      baseCurrencyCode: input.baseCurrencyCode ?? "NIO",
      locale: "es-NI",
      updatedByUserId: null,
    },
    exchangeRateRepository,
    auditLog,
  });

  return { currencyRepository, settingsRepository, exchangeRateRepository, auditLog };
}

describe("changeBaseCurrency", () => {
  const now = () => new Date(NOW);

  it("cambia la base y devuelve de qué moneda a cuál", async () => {
    const { currencyRepository, settingsRepository } = dependencies({
      currencies: [currencyRecord({ code: "NIO", sortOrder: 0 }), currencyRecord({ code: "USD", sortOrder: 1 })],
    });

    const { data } = await changeBaseCurrency(
      { code: "usd" },
      { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
    );

    expect(data).toEqual({
      baseCurrencyCode: "USD",
      locale: "es-NI",
      previousBaseCurrencyCode: "NIO",
    });
    expect(await settingsRepository.getSettings()).toMatchObject({
      baseCurrencyCode: "USD",
      updatedByUserId: "user_owner",
    });
  });

  it("cierra los períodos de la base anterior sin reescribir su tasa", async () => {
    const usdToNio = exchangeRateRecord({
      fromCurrencyCode: "USD",
      toCurrencyCode: "NIO",
      rate: 36.5,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    });
    const eurToNio = exchangeRateRecord({
      fromCurrencyCode: "EUR",
      toCurrencyCode: "NIO",
      rate: 39.42,
      effectiveFrom: "2026-09-10T00:00:00.000Z",
    });
    const { currencyRepository, settingsRepository, exchangeRateRepository } = dependencies({
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
      rates: [usdToNio, eurToNio],
    });

    await changeBaseCurrency(
      { code: "USD" },
      { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
    );

    expect(await exchangeRateRepository.listActiveRatesTo("NIO")).toEqual([]);
    expect(await exchangeRateRepository.listRatesForPair("USD", "NIO")).toEqual([
      { ...usdToNio, effectiveTo: NOW },
    ]);
    expect(await exchangeRateRepository.listRatesForPair("EUR", "NIO")).toEqual([
      { ...eurToNio, effectiveTo: NOW },
    ]);
  });

  it("firma el asiento del cambio con de/para y el formato regional", async () => {
    const { currencyRepository, settingsRepository, auditLog } = dependencies({
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
    });

    await changeBaseCurrency(
      { code: "USD", locale: "en-US" },
      { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
    );

    expect((auditLog as InMemoryAuditLogRepository).listByAction("finance.baseCurrency.changed")).toEqual([
      {
        action: "finance.baseCurrency.changed",
        actorUserId: "user_owner",
        targetType: "BusinessCurrencySettings",
        targetId: "default",
        detail: {
          fromBaseCurrencyCode: "NIO",
          toBaseCurrencyCode: "USD",
          locale: "en-US",
        },
      },
    ]);
  });

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-80`, `money-change` § AUDITORÍA) — **la fila y el asiento son
   * una sola unidad**, igual que en el registro de una tasa.
   *
   * Cambiar la base es la otra operación que cambia el **significado** de la plata: escribe la fila única,
   * cierra los períodos de tasa abiertos contra la base anterior y firma el asiento. Si el asiento falla, no
   * puede quedar una base nueva sin el cierre de sus tasas —el cierre siguiente saldría convertido contra
   * otra moneda— ni un cierre sin asiento. Es el espejo del test que ya existía para la tasa.
   */
  it("si el asiento falla, ni la base cambia ni se cierran sus tasas: la fila y el asiento son una unidad", async () => {
    const usdToNio = exchangeRateRecord({
      fromCurrencyCode: "USD",
      toCurrencyCode: "NIO",
      rate: 36.5,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    });
    const { currencyRepository, settingsRepository, exchangeRateRepository } = dependencies({
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
      rates: [usdToNio],
      auditLog: {
        async record() {
          throw new Error("la base no responde");
        },
      },
    });

    await expect(
      changeBaseCurrency(
        { code: "USD" },
        { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
      ),
    ).rejects.toThrow("la base no responde");

    expect(await settingsRepository.getSettings()).toMatchObject({ baseCurrencyCode: "NIO" });
    expect(await exchangeRateRepository.listRatesForPair("USD", "NIO")).toEqual([usdToNio]);
  });

  it("no toca ningún cobro: el hecho histórico conserva su equivalencia", async () => {
    const { currencyRepository, settingsRepository } = dependencies({
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
    });
    const paymentRepository = new InMemoryPaymentRepository();
    const payment = await paymentRepository.createPayment({
      orderId: "ord_01",
      method: "cash",
      amount: 365,
      currency: "NIO",
    });
    const before = { ...payment };
    const snapshot = JSON.stringify(before);

    // La guarda: si alguien cablea un repositorio de cobros en este caso de uso y lo escribe, esto se
    // pone rojo. `Refund`, `Shift` e `Invoice` ni siquiera aparecen entre las dependencias.
    let paymentCalls = 0;
    const guardedPayments = new Proxy(paymentRepository, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== "function") return value;

        return (...args: unknown[]) => {
          paymentCalls += 1;
          return (value as (...inner: unknown[]) => unknown).apply(target, args);
        };
      },
    });

    const withExtraRepository = { currencyRepository, settingsRepository, payments: guardedPayments };

    await changeBaseCurrency(
      { code: "USD" },
      { ...withExtraRepository, actorUserId: "user_owner", now },
    );

    expect(paymentCalls).toBe(0);
    expect(JSON.stringify(await paymentRepository.findPaymentById(payment.id))).toBe(snapshot);
  });

  it("la moneda base tiene que estar en el catálogo", async () => {
    const { currencyRepository, settingsRepository } = dependencies({
      currencies: [currencyRecord({ code: "NIO" })],
    });

    await expect(
      changeBaseCurrency(
        { code: "EUR" },
        { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("no se puede elegir una moneda apagada como base", async () => {
    const { currencyRepository, settingsRepository } = dependencies({
      currencies: [
        currencyRecord({ code: "NIO" }),
        currencyRecord({ code: "USD", isActive: false }),
      ],
    });

    await expect(
      changeBaseCurrency(
        { code: "USD" },
        { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("la base que ya rige no se vuelve a cambiar: sería un no-op auditado", async () => {
    const { currencyRepository, settingsRepository, exchangeRateRepository } = dependencies({
      currencies: [currencyRecord({ code: "NIO" })],
      rates: [exchangeRateRecord({ fromCurrencyCode: "USD", toCurrencyCode: "NIO", rate: 36.5 })],
    });

    await expect(
      changeBaseCurrency(
        { code: "NIO" },
        { currencyRepository, settingsRepository, actorUserId: "user_owner", now },
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    // Y el período vigente sigue vigente: el cambio rechazado no dejó basura.
    expect(await exchangeRateRepository.listActiveRatesTo("NIO")).toHaveLength(1);
  });
});
