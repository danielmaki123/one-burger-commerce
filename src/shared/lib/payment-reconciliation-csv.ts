import {
  PAYMENT_METHOD_TYPE_LABELS,
  type PaymentRecord,
} from "@/modules/orders/domain/order.types";
import { buildCsvFileName, buildCsvText, csvAmount } from "@/shared/lib/csv";
import { formatShiftDateTime } from "@/shared/lib/shift-datetime";

/**
 * Tarea 10 del brief (2026-09-17) — el **CSV de conciliación** de tarjeta y transferencia (11.1/11.2).
 *
 * Es el papel con el que el owner compara el día contra el lote de la terminal y el extracto del banco: la
 * columna de **referencia** es lo que se busca en el lote (el número de voucher o de transferencia) y los
 * montos van crudos porque una planilla no suma `C$`.
 *
 * Función pura: el navegador solo baja el archivo. Las filas llegan ya filtradas por el caso de uso
 * (`listReconciliationPayments`): acá solo se decide cómo se dicen.
 */

export const RECONCILIATION_HEADERS = [
  "Fecha",
  "Local",
  "Pedido",
  "Medio",
  "Monto",
  "Moneda",
  "Referencia",
];

export function buildReconciliationCsv(
  payments: readonly PaymentRecord[],
  options: {
    locationName: string;
    baseCurrencyCode: string;
    timezone: string;
    locale: string;
  },
): string {
  const format = { timezone: options.timezone, locale: options.locale };

  return buildCsvText(
    RECONCILIATION_HEADERS,
    payments.map((payment) => [
      formatShiftDateTime(payment.createdAt, format),
      options.locationName,
      // El número de pedido es lo que el cajero recuerda: `ord_…` no se busca en el lote.
      payment.orderId,
      PAYMENT_METHOD_TYPE_LABELS[payment.method],
      csvAmount(payment.amount),
      // Sin moneda declarada, el cobro entró en la del negocio.
      (payment.currency ?? options.baseCurrencyCode).toUpperCase(),
      payment.reference ?? "",
    ]),
  );
}

/** `conciliacion-camino-de-oriente-2026-09-17.csv`. */
export function buildReconciliationCsvFileName(locationName: string, date: string): string {
  return buildCsvFileName("conciliacion", locationName, date);
}
