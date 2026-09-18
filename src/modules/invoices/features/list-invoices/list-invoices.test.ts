import { describe, expect, it, vi } from "vitest";

import type { InvoiceRecord } from "../../domain/invoice";
import type { InvoiceRepository, ListInvoicesFilters } from "../../ports/invoice-repository";
import {
  INVOICE_LIST_DEFAULT_LIMIT,
  INVOICE_LIST_MAX_LIMIT,
  listInvoices,
} from "./list-invoices";

/**
 * Punto 2 del roadmap (2026-09-18) — la lista de facturas del Historial.
 *
 * La pantalla manda lo que tiene (texto libre incluido) y el caso de uso lo deja en la forma que el
 * puerto espera: un estado que no existe o una fecha basura se descartan **antes** de consultar —un 400
 * por un filtro mal formado fue exactamente el bug que rompió la bandeja de órdenes— y nunca se piden
 * más filas que el tope.
 */

function recordingRepository() {
  const captured: ListInvoicesFilters[] = [];
  const repository: Pick<InvoiceRepository, "list"> = {
    list: vi.fn(async (filters: ListInvoicesFilters) => {
      captured.push(filters);
      return [] as InvoiceRecord[];
    }),
  };

  return { repository, captured };
}

describe("listInvoices", () => {
  it("recorta los textos y descarta los que quedaron vacíos", async () => {
    const { repository, captured } = recordingRepository();

    await listInvoices(
      { search: "  ana  ", number: "  ", customer: "  Ana Pérez " },
      { invoiceRepository: repository },
    );

    expect(captured[0]).toMatchObject({ search: "ana", number: null, customer: "Ana Pérez" });
  });

  it("solo filtra por un estado que exista", async () => {
    const { repository, captured } = recordingRepository();

    await listInvoices({ status: "voided" }, { invoiceRepository: repository });
    await listInvoices({ status: "no-existe" }, { invoiceRepository: repository });

    expect(captured[0].status).toBe("voided");
    expect(captured[1].status).toBeNull();
  });

  it("convierte el rango de fechas y descarta lo que no es una fecha", async () => {
    const { repository, captured } = recordingRepository();

    await listInvoices(
      { dateFrom: "2026-09-01T06:00:00.000Z", dateTo: "basura" },
      { invoiceRepository: repository },
    );

    expect(captured[0].issuedFrom).toEqual(new Date("2026-09-01T06:00:00.000Z"));
    expect(captured[0].issuedTo).toBeNull();
  });

  it("pasa el alcance por sucursal tal cual: `null` son todas", async () => {
    const { repository, captured } = recordingRepository();

    await listInvoices({ locationIds: ["loc_norte"] }, { invoiceRepository: repository });
    await listInvoices({ locationIds: null }, { invoiceRepository: repository });

    expect(captured[0].locationIds).toEqual(["loc_norte"]);
    expect(captured[1].locationIds).toBeNull();
  });

  it("no se puede pedir la tabla entera: tope de filas", async () => {
    const { repository, captured } = recordingRepository();

    await listInvoices({}, { invoiceRepository: repository });
    await listInvoices({ limit: 5_000 }, { invoiceRepository: repository });

    expect(captured[0].limit).toBe(INVOICE_LIST_DEFAULT_LIMIT);
    expect(captured[1].limit).toBe(INVOICE_LIST_MAX_LIMIT);
  });
});
