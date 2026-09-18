/**
 * Punto 4 del roadmap (2026-09-18) — los datos fiscales del cliente, normalizados en un solo lugar.
 *
 * El POS pregunta «¿el cliente pide factura con RUC?» y con el tilde puesto el RUC y la razón social son
 * **obligatorios**. La regla vive en el dominio y no en la pantalla porque el alta de un pedido es una
 * API pública: el servidor no puede guardar media factura —un RUC sin razón social, o un RUC de tres
 * letras— por más que el mostrador lo impida.
 *
 * Sin los dos datos completos se devuelve `null` en los dos: el cliente se guarda igual (la venta sigue),
 * solo que sin datos fiscales. No se inventa ni se completa a medias.
 */

/** El mínimo del RUC que pide el mostrador (y el que ya usa la factura). */
export const MIN_TAX_ID_LENGTH = 8;

/** Los topes de las columnas (`Customer.taxId` / `Customer.legalName`). */
const MAX_TAX_ID_LENGTH = 40;
const MAX_LEGAL_NAME_LENGTH = 120;

export type CustomerFiscalData = { taxId: string | null; legalName: string | null };

function clean(value: string | null | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

export function resolveCustomerFiscalData(input: {
  taxId?: string | null;
  legalName?: string | null;
}): CustomerFiscalData {
  const taxId = clean(input.taxId, MAX_TAX_ID_LENGTH);
  const legalName = clean(input.legalName, MAX_LEGAL_NAME_LENGTH);

  if (taxId.length < MIN_TAX_ID_LENGTH || legalName.length === 0) {
    return { taxId: null, legalName: null };
  }

  return { taxId, legalName };
}
