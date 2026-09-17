import type { PosDraft, PosDraftLine } from "./pos-draft";

/**
 * Bloque 12.3 del roadmap del POS (Fase 2) — el borrador de la venta guardado en el dispositivo.
 *
 * El cajero arma la venta y, si se recarga la pantalla, se corta la luz o se va la red, el borrador tiene
 * que **seguir ahí**: perder la venta en curso es volver a tocar todo con el cliente adelante. Se guarda
 * en el dispositivo y no en el servidor porque todavía **no es un pedido** (nada que cobrar ni que
 * auditar): es el carrito de un mostrador.
 *
 * Acá solo vive el texto (serializar y leer): el `localStorage` lo toca el hook de la pantalla, así que
 * este módulo es puro y se prueba sin navegador. El texto guardado se lee **defensivamente**: un guardado
 * viejo, incompleto o escrito a mano no puede romper el mostrador — se descarta la línea mala y se queda
 * con el resto; si no queda nada, no hay venta que recuperar.
 *
 * Dos reglas más: el borrador es de **un** local (cambiar de sucursal no resucita la venta de la otra) y
 * un borrador vacío no se guarda (no hay nada que recuperar y así el aviso de «recuperamos la venta» no
 * aparece por un carrito que el cajero vació a propósito).
 */

function readLine(value: unknown): PosDraftLine | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<PosDraftLine>;
  const productId = typeof candidate.productId === "string" ? candidate.productId.trim() : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const unitPrice = candidate.unitPrice;
  const quantity = candidate.quantity;
  const notes = typeof candidate.notes === "string" ? candidate.notes : undefined;
  const packaging = candidate.packagingUnitAmount;

  if (productId === "" || name === "") return null;
  if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return null;
  if (packaging !== undefined && (typeof packaging !== "number" || !Number.isFinite(packaging) || packaging < 0)) {
    return null;
  }

  return {
    productId,
    name,
    unitPrice,
    quantity,
    ...(packaging === undefined ? {} : { packagingUnitAmount: packaging }),
    ...(notes === undefined ? {} : { notes }),
  };
}

/** El texto que se guarda en el dispositivo para una venta de mostrador. */
export function serializePosDraft(draft: PosDraft): string {
  return JSON.stringify({
    locationId: draft.locationId,
    lines: draft.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      unitPrice: line.unitPrice,
      ...(line.packagingUnitAmount === undefined
        ? {}
        : { packagingUnitAmount: line.packagingUnitAmount }),
      quantity: line.quantity,
      ...(line.notes === undefined ? {} : { notes: line.notes }),
    })),
  });
}

/**
 * Lee el borrador guardado. Devuelve `null` cuando no hay nada que recuperar para **ese** local: sin
 * texto, con texto ilegible, sin líneas válidas o si el guardado es de otra sucursal.
 */
export function parsePosDraft(raw: string | null, locationId: string): PosDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as { locationId?: unknown; lines?: unknown };
  if (candidate.locationId !== locationId) return null;
  if (!Array.isArray(candidate.lines)) return null;

  const lines = candidate.lines
    .map(readLine)
    .filter((line): line is PosDraftLine => line !== null);

  if (lines.length === 0) return null;

  return { locationId, lines };
}
