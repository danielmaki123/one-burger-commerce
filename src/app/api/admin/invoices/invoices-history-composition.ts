import { assertCanViewHistory, resolveHistoryLocationIds } from "./invoice-route-helpers";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { PrismaInvoiceRepository } from "@/modules/invoices/adapters/prisma-invoice-repository";
import { listInvoices } from "@/modules/invoices/features/list-invoices/list-invoices";

/**
 * Punto 2 del roadmap (2026-09-18) — la composición del listado de facturas.
 *
 * Vive aparte de `route.ts` porque el handler tiene un tope de 50 líneas y solo orquesta. Acá se resuelve
 * lo que hace falta para consultar: el permiso de la sección, el alcance por sucursal (una pedida fuera
 * del alcance se ignora) y los filtros que llegan por query.
 */
export async function loadInvoicesHistory(input: {
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  query: URLSearchParams;
}) {
  assertCanViewHistory(input.role);

  const locationIds =
    resolveHistoryLocationIds({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
      requestedLocationId: input.query.get("locationId"),
    }) ?? null;

  const invoices = await listInvoices(
    {
      status: input.query.get("status"),
      search: input.query.get("search"),
      number: input.query.get("number"),
      customer: input.query.get("customer"),
      dateFrom: input.query.get("dateFrom"),
      dateTo: input.query.get("dateTo"),
      locationIds,
    },
    { invoiceRepository: new PrismaInvoiceRepository() },
  );

  return { invoices, locationIds };
}
