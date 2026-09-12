import type { LocationCatalogItem } from "@/modules/locations/features/list-location-catalog/list-location-catalog";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";

/**
 * T8 fase 4b — la pantalla del catálogo por local.
 *
 * El local guarda **excepciones**, así que la fila tiene que contar dos cosas a la vez: el
 * precio del negocio y el que cobra este local (el que resolvería el servidor). El
 * formulario trabaja con texto: un precio vacío es "volver al precio base", no un cero.
 */
export const CATALOG_STATUS_LABELS = {
  sold: "Se vende acá",
  unavailable: "Agotado acá",
  "not-sold": "No se vende acá",
} as const;

export type CatalogStatus = keyof typeof CATALOG_STATUS_LABELS;

export function locationCatalogStatus(item: Pick<LocationCatalogItem, "isSold" | "isAvailable">): CatalogStatus {
  if (!item.isSold) return "not-sold";
  return item.isAvailable ? "sold" : "unavailable";
}

export function describeLocationProductRow(
  item: Pick<LocationCatalogItem, "price" | "basePrice" | "hasPriceOverride">,
  currency: CurrencyFormat,
): string {
  const own = formatCurrency(item.price, currency);

  // Con precio propio se muestra también el del negocio: si no, el owner no sabe qué está
  // pisando ni cuánto se aleja del precio general.
  return item.hasPriceOverride
    ? `${own} · base ${formatCurrency(item.basePrice, currency)}`
    : own;
}

export function describeCatalogSummary(meta: {
  total: number;
  sold: number;
  unavailable: number;
  overridden: number;
}): string {
  const products = meta.total === 1 ? "1 producto" : `${meta.total} productos`;

  if (meta.unavailable === 0 && meta.overridden === 0) {
    return `${products} · todos al precio del negocio`;
  }

  const parts = [products, `${meta.sold} en este local`];
  if (meta.unavailable > 0) parts.push(`${meta.unavailable} agotados`);
  if (meta.overridden > 0) parts.push(`${meta.overridden} con precio propio`);

  return parts.join(" · ");
}

export type CatalogFormState = {
  priceOverride: string;
  isAvailable: boolean;
  isActive: boolean;
};

export function createEmptyCatalogForm(): CatalogFormState {
  return { priceOverride: "", isAvailable: true, isActive: true };
}

export function catalogItemToForm(item: LocationCatalogItem): CatalogFormState {
  return {
    priceOverride: item.hasPriceOverride ? String(item.price) : "",
    isAvailable: item.isAvailable,
    isActive: item.isSold,
  };
}

export function catalogFormToInput(form: CatalogFormState): {
  priceOverride: number | null;
  isAvailable: boolean;
  isActive: boolean;
} {
  const trimmed = form.priceOverride.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);

  return {
    priceOverride: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    isAvailable: form.isAvailable,
    isActive: form.isActive,
  };
}
