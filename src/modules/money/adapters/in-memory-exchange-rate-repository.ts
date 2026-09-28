import { randomUUID } from "node:crypto";

import { InMemoryAuditLogRepository } from "@/modules/audit/adapters/in-memory-audit-log-repository";
import type { AuditLogRepository } from "@/modules/audit/ports/audit-log-repository";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { closePeriod, type ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";
import type {
  CreateExchangeRateInput,
  ExchangeRateRepository,
} from "@/modules/money/ports/exchange-rate-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el doble en memoria del historial de tasas.
 *
 * Reproduce las dos propiedades que importan: registrar una tasa **cierra** la anterior sin reescribirla,
 * y la fila + el asiento son **todo o nada**. El rollback se hace guardando una copia del historial
 * antes de escribir: si el asiento falla, se restaura. Es lo que permite que un test unitario demuestre
 * que el asiento pertenece a la misma unidad (la atomicidad real se prueba contra PostgreSQL).
 */
export class InMemoryExchangeRateRepository implements ExchangeRateRepository {
  private rates: ExchangeRateRecord[];

  /** El sink del asiento. Un test puede pasarlo y leer lo que se firmó. */
  readonly auditLog: AuditLogRepository;

  constructor(seed: { rates?: ExchangeRateRecord[]; auditLog?: AuditLogRepository } = {}) {
    this.rates = (seed.rates ?? []).map((rate) => ({ ...rate }));
    this.auditLog = seed.auditLog ?? new InMemoryAuditLogRepository();
  }

  async listRatesForPair(from: string, to: string): Promise<ExchangeRateRecord[]> {
    const fromKey = currencyKey(from);
    const toKey = currencyKey(to);

    return this.rates
      .filter((rate) => rate.fromCurrencyCode === fromKey && rate.toCurrencyCode === toKey)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
      .map((rate) => ({ ...rate }));
  }

  async listActiveRatesTo(baseCurrencyCode: string): Promise<ExchangeRateRecord[]> {
    const base = currencyKey(baseCurrencyCode);

    return this.rates
      .filter((rate) => rate.toCurrencyCode === base && rate.effectiveTo === null)
      .sort((a, b) => a.fromCurrencyCode.localeCompare(b.fromCurrencyCode))
      .map((rate) => ({ ...rate }));
  }

  async createRate(input: CreateExchangeRateInput): Promise<ExchangeRateRecord> {
    const from = currencyKey(input.fromCurrencyCode);
    const to = currencyKey(input.toCurrencyCode);
    const snapshot = this.rates.map((rate) => ({ ...rate }));

    try {
      const previous = this.rates.find(
        (rate) =>
          rate.fromCurrencyCode === from && rate.toCurrencyCode === to && rate.effectiveTo === null,
      );

      if (previous) {
        // Cierra, no pisa: `closePeriod` dice qué se escribe y la tasa del período anterior no se toca.
        const closed = closePeriod(previous, input.effectiveFrom);
        const stored = this.rates.find((rate) => rate.id === closed.id);
        if (stored) stored.effectiveTo = closed.effectiveTo;
      }

      const created: ExchangeRateRecord = {
        id: `rate_${randomUUID()}`,
        fromCurrencyCode: from,
        toCurrencyCode: to,
        rate: input.rate,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
      };

      this.rates.push(created);

      // El asiento, en la misma unidad: si falla, se restaura el historial completo.
      await this.auditLog.record(input.audit);

      return { ...created };
    } catch (error) {
      this.rates = snapshot;
      throw error;
    }
  }

  async closeActiveRate(from: string, to: string, effectiveTo: string): Promise<number> {
    const fromKey = currencyKey(from);
    const toKey = currencyKey(to);
    let closed = 0;

    for (const rate of this.rates) {
      if (rate.fromCurrencyCode !== fromKey || rate.toCurrencyCode !== toKey) continue;
      if (rate.effectiveTo !== null) continue;

      rate.effectiveTo = effectiveTo;
      closed += 1;
    }

    return closed;
  }

  async closeRatesTo(baseCurrencyCode: string, effectiveTo: string): Promise<number> {
    const base = currencyKey(baseCurrencyCode);
    let closed = 0;

    for (const rate of this.rates) {
      if (rate.toCurrencyCode !== base || rate.effectiveTo !== null) continue;

      rate.effectiveTo = effectiveTo;
      closed += 1;
    }

    return closed;
  }

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **una foto del historial y su restauración**.
   *
   * `closeRatesTo` lo usa el **cambio de moneda base**, que escribe en tres lugares (la fila única, este
   * historial y el asiento). El puerto devuelve un número —cuántos períodos cerró—, que no alcanza para
   * deshacer el cierre si el asiento falla: sin esto, el doble dejaba la base en `NIO` y **las tasas
   * cerradas**, o sea un estado que la base real nunca tendría. Lo encontró el test de atomicidad del
   * cambio de base.
   *
   * Son métodos del **doble**, no del puerto: reproducen lo que en Postgres hace la transacción (volver al
   * estado anterior), y una transacción no se agrega a una interfaz.
   */
  snapshot(): ExchangeRateRecord[] {
    return this.rates.map((rate) => ({ ...rate }));
  }

  restore(snapshot: ExchangeRateRecord[]): void {
    this.rates = snapshot.map((rate) => ({ ...rate }));
  }
}
