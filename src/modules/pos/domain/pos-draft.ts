import { calculateOrderTotals, roundCurrency } from "@/shared/lib/order-totals";

import { PosError } from "./pos-errors";

/**
 * TASK-301 — el borrador de una venta de mostrador (`plna.md` FASE 3).
 *
 * Es lo que el cajero arma tocando productos antes de cobrar. A propósito **no** es una segunda
 * versión de `Order`: no conoce estados, ni historial, ni token, ni PIN, y no guarda nada. Cuando la
 * venta se confirme, el alta pasa por el caso de uso que ya existe (`createOrder`), que es el único
 * que resuelve precios, empaque, propina y totales.
 *
 * El subtotal de acá es **informativo** (lo que el cajero ve mientras arma la venta): no incluye
 * empaque ni propina porque eso lo decide el servidor con la configuración del local.
 */

export interface PosDraftLine {
  productId: string;
  /** Nombre al momento de agregarlo: el mostrador no depende de una lectura posterior del catálogo. */
  name: string;
  unitPrice: number;
  /** TASK-303b — empaque por unidad. Sin dato es 0 (un producto que no cobra empaque). */
  packagingUnitAmount?: number;
  quantity: number;
  notes?: string;
  /** Las opciones elegidas (ids de `ModifierOption`). Sin dato = producto sin modificadores. */
  modifierOptionIds?: string[];
  /**
   * Los nombres de esas opciones, para la línea de la venta. Viajan con la línea por el mismo motivo
   * que `name`: el mostrador no depende de una lectura posterior del catálogo.
   */
  modifierNames?: string[];
}

/**
 * La identidad de una línea: **producto + modificadores + nota**.
 *
 * Es lo que decide si tocar dos veces el mismo producto suma cantidad o abre una línea nueva. Un DOBLE
 * con papas y un DOBLE sin extras cuestan distinto: son dos líneas. El orden de los modificadores no
 * cambia la identidad (los ids se ordenan), porque elegir A y después B es lo mismo que B y después A.
 */
export function posLineKey(
  line: Pick<PosDraftLine, "productId" | "notes" | "modifierOptionIds">,
): string {
  const modifiers = [...(line.modifierOptionIds ?? [])].sort().join(",");
  return `${line.productId}|${modifiers}|${line.notes ?? ""}`;
}

export interface PosDraft {
  locationId: string;
  lines: PosDraftLine[];
}

export function createPosDraft(locationId: string): PosDraft {
  return { locationId, lines: [] };
}

function assertLine(line: Omit<PosDraftLine, "quantity"> & { quantity: number }): void {
  if (line.productId.trim() === "") {
    throw new PosError(422, "VALIDATION_ERROR", "Falta el producto de la línea.");
  }

  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new PosError(422, "VALIDATION_ERROR", "La cantidad tiene que ser un entero de 1 o más.", {
      quantity: "La cantidad tiene que ser un entero de 1 o más.",
    });
  }

  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
    throw new PosError(422, "VALIDATION_ERROR", "El precio de la línea no puede ser negativo.", {
      unitPrice: "El precio de la línea no puede ser negativo.",
    });
  }

  const packaging = line.packagingUnitAmount ?? 0;
  if (!Number.isFinite(packaging) || packaging < 0) {
    throw new PosError(422, "VALIDATION_ERROR", "El empaque de la línea no puede ser negativo.", {
      packagingUnitAmount: "El empaque de la línea no puede ser negativo.",
    });
  }
}

/**
 * Agrega una línea. Si ya hay una del mismo producto **con los mismos modificadores y la misma nota**,
 * suma la cantidad: en el mostrador, tocar dos veces el mismo plato es "dos", no dos renglones iguales.
 * Con modificadores distintos es una línea aparte (cuestan distinto).
 */
export function addPosLine(
  draft: PosDraft,
  line: Omit<PosDraftLine, "quantity"> & { quantity?: number },
): PosDraft {
  const candidate = { ...line, quantity: line.quantity ?? 1 };
  assertLine(candidate);

  const key = posLineKey(candidate);
  const index = draft.lines.findIndex((existing) => posLineKey(existing) === key);

  if (index === -1) {
    return { ...draft, lines: [...draft.lines, candidate] };
  }

  const lines = draft.lines.map((existing, position) =>
    position === index ? { ...existing, quantity: existing.quantity + candidate.quantity } : existing,
  );

  return { ...draft, lines };
}

/**
 * Cambia la cantidad de **una** línea del borrador; con 0 la saca.
 *
 * Se direcciona por `posLineKey` y no por producto: el mismo plato con dos configuraciones distintas
 * son dos líneas, y tocar "−" en una no puede cambiar la otra.
 */
export function setPosLineQuantity(draft: PosDraft, lineKey: string, quantity: number): PosDraft {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new PosError(422, "VALIDATION_ERROR", "La cantidad tiene que ser un entero de 0 o más.", {
      quantity: "La cantidad tiene que ser un entero de 0 o más.",
    });
  }

  if (quantity === 0) {
    return removePosLine(draft, lineKey);
  }

  return {
    ...draft,
    lines: draft.lines.map((line) =>
      posLineKey(line) === lineKey ? { ...line, quantity } : line,
    ),
  };
}

export function removePosLine(draft: PosDraft, lineKey: string): PosDraft {
  return { ...draft, lines: draft.lines.filter((line) => posLineKey(line) !== lineKey) };
}

/** Subtotal informativo del borrador: precio × cantidad, sin empaque, propina ni descuentos. */
export function posDraftSubtotal(draft: PosDraft): number {
  return roundCurrency(
    draft.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  );
}

/**
 * TASK-303b — el total que el cajero va a cobrar, con la **misma fórmula que el servidor**
 * (`calculateOrderTotals`, la fuente única del total) y sin propina: el POS no la usa.
 *
 * Se calcula acá y no en la pantalla porque el cliente tiene que ver el número que se le va a
 * cobrar: mostrar solo el subtotal hacía que el empaque apareciera recién en la comanda.
 *
 * Tarea 9.6 del roadmap (Fase 2) — el **descuento del cupón** entra por acá. Se limita al subtotal (el
 * servidor hace lo mismo con el cupón y con el descuento manual): un descuento más grande que la venta
 * descuenta la venta, no la vuelve negativa, y el empaque se sigue pagando.
 */
export function posDraftTotals(
  draft: PosDraft,
  discount = 0,
): {
  subtotal: number;
  packagingAmount: number;
  total: number;
} {
  const items = draft.lines.map((line) => ({
    packagingTotalAmount: (line.packagingUnitAmount ?? 0) * line.quantity,
  }));

  const subtotal = posDraftSubtotal(draft);
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal);

  const totals = calculateOrderTotals({
    subtotal,
    discount: safeDiscount,
    deliveryFeeAmount: 0,
    items,
    tipOptIn: false,
    orderType: "pickup",
  });

  return {
    subtotal,
    packagingAmount: totals.packagingAmount,
    total: totals.total,
  };
}

/** Un borrador sin líneas o sin local no se puede cobrar; el error dice cuál de las dos cosas falta. */
export function assertPosDraftReady(draft: PosDraft): void {
  if (draft.locationId.trim() === "") {
    throw new PosError(422, "VALIDATION_ERROR", "Elegí el local de la venta.", {
      locationId: "Elegí el local de la venta.",
    });
  }

  if (draft.lines.length === 0) {
    throw new PosError(422, "VALIDATION_ERROR", "Agregá al menos un producto.", {
      lines: "Agregá al menos un producto.",
    });
  }
}
