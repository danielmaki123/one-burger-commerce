import { describe, expect, it } from "vitest";

import { InMemoryAuditLogRepository } from "@/modules/audit/adapters/in-memory-audit-log-repository";
import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";
import type { AuditLogRepository } from "@/modules/audit/ports/audit-log-repository";
import type { ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";
import { exchangeRateRecord } from "@/shared/testing/money-fixtures";

import { registerExchangeRate } from "./register-exchange-rate";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-72`, `A-80`, `D-018`) — **registrar una tasa**.
 *
 * Registrar una tasa es un **hecho nuevo**, no una edición: el período anterior se cierra y la fila nueva
 * arranca en el instante del registro. Y como es una decisión sobre plata, va firmada: la fila y su
 * asiento de `AdminAuditLog` son una sola unidad —si el asiento falla, la tasa no queda registrada—
 * (`money-change` § *AUDITORÍA*).
 *
 * El destino de la tasa es siempre **la moneda base vigente**: por eso una tasa no puede quedar apuntando
 * a una base que ya no rige (`D-018`).
 */
const NOW = "2026-09-28T12:00:00.000Z";

function dependencies(input: {
  baseCurrencyCode?: string;
  rates?: ExchangeRateRecord[];
  auditLog?: AuditLogRepository;
}) {
  const auditLog = input.auditLog ?? new InMemoryAuditLogRepository();
  const repository = new InMemoryExchangeRateRepository({
    rates: input.rates ?? [],
    auditLog,
  });
  const settingsRepository = new InMemoryBusinessCurrencySettingsRepository({
    settings: {
      baseCurrencyCode: input.baseCurrencyCode ?? "NIO",
      locale: "es-NI",
      updatedByUserId: null,
    },
    exchangeRateRepository: repository,
    ...(input.auditLog ? { auditLog: input.auditLog } : {}),
  });

  return { repository, settingsRepository, auditLog };
}

/**
 * Los asientos de una acción. `AuditLogRepository` tiene `record` —el log se **escribe**, no se lee desde el
 * dominio—, así que el filtro lo hace el test sobre el doble.
 */
function entriesOfAction(auditLog: AuditLogRepository, action: string): Array<{ action: string }> {
  const listable = auditLog as unknown as { list?: () => Array<{ action: string }> };

  return (listable.list?.() ?? []).filter((entry) => entry.action === action);
}

describe("registerExchangeRate", () => {
  const now = () => new Date(NOW);

  it("registra la tasa vigente contra la moneda base vigente", async () => {
    const { repository, settingsRepository } = dependencies({});

    const { data } = await registerExchangeRate(
      { fromCurrencyCode: "usd", rate: 36.5 },
      { repository, settingsRepository, actorUserId: "user_owner", now },
    );

    expect(data).toMatchObject({
      fromCurrencyCode: "USD",
      toCurrencyCode: "NIO",
      rate: 36.5,
      effectiveFrom: NOW,
      effectiveTo: null,
    });
    expect(await repository.listActiveRatesTo("NIO")).toEqual([data]);
  });

  it("cierra el período anterior sin reescribir su tasa", async () => {
    const previous = exchangeRateRecord({
      fromCurrencyCode: "USD",
      toCurrencyCode: "NIO",
      rate: 36,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    });
    const { repository, settingsRepository } = dependencies({ rates: [previous] });

    await registerExchangeRate(
      { fromCurrencyCode: "USD", rate: 36.5 },
      { repository, settingsRepository, actorUserId: "user_owner", now },
    );

    const history = await repository.listRatesForPair("USD", "NIO");

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      rate: 36,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: NOW,
    });
    expect(history[1]).toMatchObject({ rate: 36.5, effectiveFrom: NOW, effectiveTo: null });
  });

  it("firma el asiento de la tasa en la misma unidad", async () => {
    const { repository, settingsRepository, auditLog } = dependencies({});

    await registerExchangeRate(
      { fromCurrencyCode: "USD", rate: 36.5 },
      { repository, settingsRepository, actorUserId: "user_owner", now },
    );

    expect(entriesOfAction(auditLog, "finance.rate.registered")).toEqual([
      {
        action: "finance.rate.registered",
        actorUserId: "user_owner",
        targetType: "ExchangeRate",
        targetId: "USD:NIO",
        detail: {
          fromCurrencyCode: "USD",
          toCurrencyCode: "NIO",
          rate: 36.5,
          effectiveFrom: NOW,
        },
      },
    ]);
  });

  it("si el asiento falla, la tasa no queda registrada: la fila y el asiento son una unidad", async () => {
    const previous = exchangeRateRecord({
      fromCurrencyCode: "USD",
      toCurrencyCode: "NIO",
      rate: 36,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    });
    const { repository, settingsRepository } = dependencies({
      rates: [previous],
      auditLog: {
        async record() {
          throw new Error("la base no responde");
        },
      },
    });

    await expect(
      registerExchangeRate(
        { fromCurrencyCode: "USD", rate: 36.5 },
        { repository, settingsRepository, actorUserId: "user_owner", now },
      ),
    ).rejects.toThrow("la base no responde");

    const history = await repository.listRatesForPair("USD", "NIO");

    // Ni la fila nueva ni el cierre del período anterior: se revirtió todo.
    expect(history).toEqual([previous]);
    expect(await repository.listActiveRatesTo("NIO")).toEqual([previous]);
  });

  it("rechaza una tasa que no es un número positivo", async () => {
    const { repository, settingsRepository, auditLog } = dependencies({});

    for (const rate of [0, -3, Number.NaN]) {
      await expect(
        registerExchangeRate(
          { fromCurrencyCode: "USD", rate },
          { repository, settingsRepository, actorUserId: "user_owner", now },
        ),
      ).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
        fields: { rate: expect.stringContaining("mayor que cero") },
      });
    }

    expect(await repository.listActiveRatesTo("NIO")).toEqual([]);
    expect(entriesOfAction(auditLog, "finance.rate.registered")).toEqual([]);
  });

  it("la moneda base no lleva tasa contra sí misma", async () => {
    const { repository, settingsRepository } = dependencies({});

    await expect(
      registerExchangeRate(
        { fromCurrencyCode: "NIO", rate: 1 },
        { repository, settingsRepository, actorUserId: "user_owner", now },
      ),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("el destino es la base vigente, no la que estaba antes", async () => {
    const { repository, settingsRepository } = dependencies({ baseCurrencyCode: "USD" });

    const { data } = await registerExchangeRate(
      { fromCurrencyCode: "EUR", rate: 1.08 },
      { repository, settingsRepository, actorUserId: "user_owner", now },
    );

    expect(data.toCurrencyCode).toBe("USD");
    expect(await repository.listActiveRatesTo("USD")).toEqual([data]);
    expect(await repository.listActiveRatesTo("NIO")).toEqual([]);
  });
});
