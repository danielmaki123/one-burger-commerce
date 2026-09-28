import type { RecordAuditLogInput } from "@/modules/audit/ports/audit-log-repository";
import { MONEY_SETTINGS_ID } from "@/modules/money/domain/money.types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-80`) — **los asientos de la configuración financiera**.
 *
 * Dos hechos que hoy no dejan rastro: registrar una tasa y cambiar la moneda base. El estado queda en las
 * tablas (qué tasa rige, cuál es la base), pero no **quién** lo cambió ni **de qué a qué**, que es lo
 * único que explica seis meses después por qué un cobro se convirtió con ese número.
 *
 * El asiento se **construye** acá (una sola forma del detalle) y lo **escriben los adaptadores dentro de
 * la misma transacción** que la fila: un log que puede faltar no es auditoría
 * (`.agents/skills/money-change/SKILL.md` § *AUDITORÍA*). Por eso viaja como dato en la llamada al
 * repositorio y no por un `AuditLogRepository` aparte, que escribiría con el cliente raíz y quedaría
 * fuera de la unidad atómica.
 */

/** El alta de una tasa: la moneda, contra qué base, el valor y desde cuándo rige. */
export function rateRegisteredAuditEntry(input: {
  actorUserId: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: number;
  effectiveFrom: string;
}): RecordAuditLogInput {
  return {
    action: "finance.rate.registered",
    actorUserId: input.actorUserId,
    targetType: "ExchangeRate",
    targetId: `${input.fromCurrencyCode}:${input.toCurrencyCode}`,
    detail: {
      fromCurrencyCode: input.fromCurrencyCode,
      toCurrencyCode: input.toCurrencyCode,
      rate: input.rate,
      effectiveFrom: input.effectiveFrom,
    },
  };
}

/** El cambio de moneda base: **de** qué moneda **a** cuál, y con qué formato regional queda. */
export function baseCurrencyChangedAuditEntry(input: {
  actorUserId: string;
  previousBaseCurrencyCode: string;
  baseCurrencyCode: string;
  locale: string;
}): RecordAuditLogInput {
  return {
    action: "finance.baseCurrency.changed",
    actorUserId: input.actorUserId,
    targetType: "BusinessCurrencySettings",
    targetId: MONEY_SETTINGS_ID,
    detail: {
      fromBaseCurrencyCode: input.previousBaseCurrencyCode,
      toBaseCurrencyCode: input.baseCurrencyCode,
      locale: input.locale,
    },
  };
}
