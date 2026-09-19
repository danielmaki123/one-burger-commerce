import { isSaleAttemptKey } from "./pos-sale-attempt";
import type { PosDraft, PosDraftLine } from "./pos-draft";

/**
 * Bloque 12.3 del roadmap del POS (Fase 2) — el borrador de la venta guardado en el dispositivo.
 *
 * El cajero arma la venta y, si se recarga la pantalla, se corta la luz o se va la red, el borrador tiene
 * que **seguir ahí**: perder la venta en curso es volver a tocar todo con el cliente adelante. Se guarda
 * en el dispositivo y no en el servidor porque todavía **no es un pedido** (nada que cobrar ni que
 * auditar): es el carrito de un mostrador.
 *
 * Tarea 11 del brief (2026-09-17) — **la clave del intento de cobro viaja con el borrador**. Es el UUID
 * con el que el servidor reconoce un reintento; guardada en memoria se perdía justo cuando más hace falta
 * (la pantalla se recarga después del corte y el cajero vuelve a cobrar el mismo carrito). Un guardado
 * viejo, sin clave, se lee igual: la clave se genera de nuevo.
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

/**
 * Qué es una línea válida de la venta — **una sola regla** para el borrador y para la espera
 * (`pos-holds.ts`): las dos leen el mismo texto escrito por la misma pantalla, así que una línea que no
 * se puede recuperar en una tampoco sirve en la otra.
 */
export function readPosDraftLine(value: unknown): PosDraftLine | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<PosDraftLine>;
  const productId = typeof candidate.productId === "string" ? candidate.productId.trim() : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const unitPrice = candidate.unitPrice;
  const quantity = candidate.quantity;
  const notes = typeof candidate.notes === "string" ? candidate.notes : undefined;
  const packaging = candidate.packagingUnitAmount;
  const modifierOptionIds = candidate.modifierOptionIds;
  const modifierNames = candidate.modifierNames;

  if (productId === "" || name === "") return null;
  if (typeof unitPrice !== "number" || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) return null;
  if (packaging !== undefined && (typeof packaging !== "number" || !Number.isFinite(packaging) || packaging < 0)) {
    return null;
  }
  // Los modificadores son ids: una lista de textos no vacíos o nada. Un guardado con basura acá se
  // descarta entero (la línea), porque cobrar un producto con modificadores a medias es peor que
  // perder esa línea.
  if (
    modifierOptionIds !== undefined &&
    (!Array.isArray(modifierOptionIds) ||
      !modifierOptionIds.every((id) => typeof id === "string" && id.trim() !== ""))
  ) {
    return null;
  }
  if (
    modifierNames !== undefined &&
    (!Array.isArray(modifierNames) || !modifierNames.every((label) => typeof label === "string"))
  ) {
    return null;
  }

  return {
    productId,
    name,
    unitPrice,
    quantity,
    ...(packaging === undefined ? {} : { packagingUnitAmount: packaging }),
    ...(notes === undefined ? {} : { notes }),
    ...(modifierOptionIds === undefined ? {} : { modifierOptionIds }),
    ...(modifierNames === undefined ? {} : { modifierNames }),
  };
}

/** Lo que sale y entra del dispositivo: el borrador y la clave del intento de cobro. */
export type StoredPosDraft = {
  draft: PosDraft;
  /** `null` cuando el guardado es viejo (antes de la tarea 11) o la clave no sirve. */
  attemptKey: string | null;
};

/**
 * Cómo se guarda una línea: solo lo que existe (una línea sin nota no guarda `notes: undefined`). También
 * lo usa el guardado de la espera, por el mismo motivo que el lector: la forma de una línea es una sola.
 */
export function serializePosDraftLine(line: PosDraftLine): PosDraftLine {
  return {
    productId: line.productId,
    name: line.name,
    unitPrice: line.unitPrice,
    ...(line.packagingUnitAmount === undefined
      ? {}
      : { packagingUnitAmount: line.packagingUnitAmount }),
    quantity: line.quantity,
    ...(line.notes === undefined ? {} : { notes: line.notes }),
    ...(line.modifierOptionIds === undefined ? {} : { modifierOptionIds: line.modifierOptionIds }),
    ...(line.modifierNames === undefined ? {} : { modifierNames: line.modifierNames }),
  };
}

/** El texto que se guarda en el dispositivo para una venta de mostrador. */
export function serializePosDraft(draft: PosDraft, attemptKey?: string | null): string {
  return JSON.stringify({
    locationId: draft.locationId,
    lines: draft.lines.map(serializePosDraftLine),
    ...(isSaleAttemptKey(attemptKey) ? { attemptKey } : {}),
  });
}

/**
 * Lee el borrador guardado. Devuelve `null` cuando no hay nada que recuperar para **ese** local: sin
 * texto, con texto ilegible, sin líneas válidas o si el guardado es de otra sucursal.
 */
export function parsePosDraft(raw: string | null, locationId: string): StoredPosDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as { locationId?: unknown; lines?: unknown; attemptKey?: unknown };
  if (candidate.locationId !== locationId) return null;
  if (!Array.isArray(candidate.lines)) return null;

  const lines = candidate.lines
    .map(readPosDraftLine)
    .filter((line): line is PosDraftLine => line !== null);

  if (lines.length === 0) return null;

  return {
    draft: { locationId, lines },
    attemptKey: isSaleAttemptKey(candidate.attemptKey) ? candidate.attemptKey : null,
  };
}
