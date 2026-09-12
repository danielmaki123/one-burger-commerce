import type {
  LocationProductInput,
  LocationProductRecord,
} from "@/modules/locations/domain/location.types";

/**
 * El catálogo por local (T8 fase 4).
 *
 * La regla que sostiene todo: **sin fila para ese local, el producto se vende al precio
 * base**. Tres consecuencias, las tres buenas:
 *  - un negocio de un solo local sigue funcionando sin configurar nada (no hay filas);
 *  - un producto nuevo se vende en todos los locales sin trabajo extra;
 *  - el menú público no puede quedar vacío por no haber copiado un catálogo.
 *
 * Con fila, el local manda: precio propio, agotado o "acá no lo vendemos".
 */

/** Precio que ve el cliente en este local. */
export function resolveLocationPrice({
  basePrice,
  priceOverride,
}: {
  basePrice: number;
  priceOverride: number | null | undefined;
}): number {
  return priceOverride ?? basePrice;
}

export function validateLocationProductInput(input: LocationProductInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.priceOverride !== null) {
    if (!Number.isFinite(input.priceOverride) || input.priceOverride < 0) {
      errors.priceOverride = "El precio no puede ser negativo";
    } else if (Math.round(input.priceOverride * 100) !== input.priceOverride * 100) {
      errors.priceOverride = "Usá como máximo dos decimales";
    }
  }

  return errors;
}

function rowsForLocation(rows: LocationProductRecord[], locationId: string): LocationProductRecord[] {
  return rows.filter((row) => row.locationId === locationId);
}

/** Qué productos ofrece un local: todos los del negocio menos los que apagó. */
export function catalogProductIds({
  productIds,
  rows,
  locationId,
}: {
  productIds: string[];
  rows: LocationProductRecord[];
  /** Obligatorio a propósito: el catálogo solo tiene sentido **por** local. */
  locationId: string;
}): string[] {
  const own = rowsForLocation(rows, locationId);
  const off = new Set(
    own.filter((row) => !row.isActive).map((row) => row.productId),
  );

  return productIds.filter((productId) => !off.has(productId));
}

/**
 * Números para el encabezado de la pantalla: cuántos productos hay, cuántos vende el local,
 * cuántos están agotados ahí y cuántos tienen precio propio.
 */
export function summarizeLocationCatalog({
  productIds,
  rows,
  locationId,
}: {
  productIds: string[];
  rows: LocationProductRecord[];
  locationId: string;
}): { total: number; sold: number; unavailable: number; overridden: number } {
  const own = rowsForLocation(rows, locationId);
  const sold = catalogProductIds({ productIds, rows, locationId });
  const soldSet = new Set(sold);
  const relevant = own.filter((row) => soldSet.has(row.productId));

  return {
    total: productIds.length,
    sold: sold.length,
    unavailable: relevant.filter((row) => !row.isAvailable).length,
    overridden: relevant.filter((row) => row.priceOverride !== null).length,
  };
}
