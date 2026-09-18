import { MIN_TAX_ID_LENGTH, resolveCustomerFiscalData } from "@/modules/customers/domain/customer-fiscal-data";

/**
 * Punto 4 del roadmap (2026-09-18) — la factura con RUC en el mostrador.
 *
 * El checkbox «Cliente pide factura con RUC» está **desmarcado por defecto**: la mayoría de las ventas de
 * mostrador no llevan factura. Con el tilde puesto, el RUC (mínimo 8 caracteres) y la razón social son
 * obligatorios; al desmarcarlo, los datos **se limpian** para que el próximo cliente no herede el RUC del
 * anterior.
 *
 * Vive acá y no dentro de `pos-client.tsx` (deuda congelada, 916 líneas) porque es una regla con su
 * propio test; la pantalla solo la usa.
 */

export type PosFiscalDraft = { wantsInvoice: boolean; taxId: string; legalName: string };

export type PosFiscalPayload =
  | { ok: true; taxId: string | null; legalName: string | null }
  | { ok: false; field: "taxId" | "legalName"; message: string };

/** El estado inicial: sin factura y sin datos (lo que el POS estrena en cada venta). */
export const EMPTY_POS_FISCAL_DRAFT: PosFiscalDraft = {
  wantsInvoice: false,
  taxId: "",
  legalName: "",
};

/**
 * Qué viaja al servidor y si hay algo que reclamar antes de cobrar.
 *
 * El servidor valida lo mismo (`sale-payload`): esto es para que el cajero lo vea junto al campo y no
 * después de un viaje.
 */
export function buildPosFiscalPayload(draft: PosFiscalDraft): PosFiscalPayload {
  if (!draft.wantsInvoice) return { ok: true, taxId: null, legalName: null };

  const taxId = draft.taxId.trim();
  const legalName = draft.legalName.trim();

  if (taxId.length === 0) {
    return { ok: false, field: "taxId", message: "Escribí el RUC del cliente." };
  }

  if (taxId.length < MIN_TAX_ID_LENGTH) {
    return {
      ok: false,
      field: "taxId",
      message: `El RUC tiene que tener al menos ${MIN_TAX_ID_LENGTH} caracteres.`,
    };
  }

  if (legalName.length === 0) {
    return { ok: false, field: "legalName", message: "Escribí la razón social." };
  }

  // La normalización es la del dominio: una sola regla para la pantalla y el servidor.
  const resolved = resolveCustomerFiscalData({ taxId, legalName });
  if (!resolved.taxId || !resolved.legalName) {
    return { ok: false, field: "taxId", message: "Revisá el RUC y la razón social." };
  }

  return { ok: true, taxId: resolved.taxId, legalName: resolved.legalName };
}
