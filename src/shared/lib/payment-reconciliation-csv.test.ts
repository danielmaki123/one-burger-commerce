import { describe, expect, it } from "vitest";

import type { PaymentRecord } from "@/modules/orders/domain/order.types";

import {
  buildReconciliationCsv,
  buildReconciliationCsvFileName,
  RECONCILIATION_HEADERS,
} from "./payment-reconciliation-csv";

/**
 * Tarea 10 del brief (2026-09-17) — el **CSV de conciliación** de tarjeta y transferencia (11.1/11.2).
 *
 * Es el papel con el que el owner compara contra el lote de la terminal y el extracto del banco, así que
 * lo que se fija acá es qué tiene que poder verse fila por fila: cuándo, en qué sucursal, qué pedido, por
 * qué medio, cuánto y con qué **referencia** (el número de voucher o de transferencia es lo que se busca
 * en el lote). Los montos van crudos y la hora es la del local.
 */

const options = {
  locationName: "Camino de Oriente",
  baseCurrencyCode: "NIO",
  timezone: "America/Managua",
  locale: "es-NI",
};

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay_01",
    orderId: "ord_01",
    method: "card",
    amount: 500,
    currency: null,
    changeAmount: 0,
    tip: 0,
    reference: "VOUCHER-123",
    createdAt: "2026-09-17T15:00:00.000Z",
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    ...overrides,
  };
}

describe("buildReconciliationCsv", () => {
  it("una fila por cobro, con el encabezado declarado", () => {
    const csv = buildReconciliationCsv([payment()], options);
    const [header, row] = csv.split("\r\n");

    expect(header).toBe(RECONCILIATION_HEADERS.join(";"));
    expect(row?.split(";")).toEqual([
      "17/09/2026, 09:00 a. m.",
      "Camino de Oriente",
      "ord_01",
      "Tarjeta",
      "500.00",
      "NIO",
      "VOUCHER-123",
    ]);
  });

  it("la hora es la del local, no la del servidor", () => {
    // 15:00Z son las 09:00 en Managua y las 17:00 en Madrid: si la zona se ignorara, dirían lo mismo.
    const managua = buildReconciliationCsv([payment()], options);
    const madrid = buildReconciliationCsv([payment()], { ...options, timezone: "Europe/Madrid" });

    expect(managua).toContain("09:00 a. m.");
    expect(madrid).toContain("05:00 p. m.");
    expect(managua).not.toContain("05:00 p. m.");
  });

  it("un cobro en dólares se exporta en dólares, sin convertirlo", () => {
    const row = buildReconciliationCsv([payment({ amount: 20, currency: "USD" })], options).split(
      "\r\n",
    )[1];

    expect(row?.split(";")).toContain("USD");
    expect(row?.split(";")).toContain("20.00");
  });

  it("sin referencia la celda queda vacía, no dice «null»", () => {
    const row = buildReconciliationCsv(
      [payment({ reference: null, method: "transfer" })],
      options,
    ).split("\r\n")[1];

    expect(row?.split(";")).toEqual([
      "17/09/2026, 09:00 a. m.",
      "Camino de Oriente",
      "ord_01",
      "Transferencia",
      "500.00",
      "NIO",
      "",
    ]);
  });

  it("un encabezado y ningún cobro es un archivo válido (el día no tuvo tarjeta)", () => {
    const csv = buildReconciliationCsv([], options);

    expect(csv).toBe(RECONCILIATION_HEADERS.join(";"));
  });
});

describe("buildReconciliationCsvFileName", () => {
  it("nombra el archivo con la sucursal y el día del negocio", () => {
    expect(buildReconciliationCsvFileName("Camino de Oriente", "2026-09-17")).toBe(
      "conciliacion-camino-de-oriente-2026-09-17.csv",
    );
  });
});
