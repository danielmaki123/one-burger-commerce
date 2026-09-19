import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";

import type { ModifierGroupRecord } from "./menu.types";

/**
 * El texto y el precio de un modificador, en el dominio del menú.
 *
 * Estaban en la ficha pública (el precio en `product-detail-copy.ts` y la frase de cada grupo dentro de
 * `page.tsx`). El mostrador necesita **las mismas dos cosas** para su selector, así que viven acá: una
 * sola redacción y un solo formato para la carta y para el POS.
 */

/** El precio de una opción: con signo cuando suma (`+C$15.00`) y pelado cuando no. */
export function formatModifierOptionPrice(priceDelta: number, format: CurrencyFormat): string {
  if (priceDelta > 0) {
    return `+${formatCurrency(priceDelta, format)}`;
  }

  return formatCurrency(0, format);
}

/** Qué tiene que elegir quien compra en este grupo. */
export function describeModifierGroup(group: ModifierGroupRecord): string {
  if (group.maxSelections === 1) {
    return "Elegí una opción para continuar.";
  }

  if (group.minSelections === group.maxSelections && group.maxSelections > 1) {
    return `Elegí exactamente ${group.maxSelections} opciones.`;
  }

  if (group.minSelections > 0 || group.maxSelections > 1) {
    return `Elegí entre ${group.minSelections} y ${group.maxSelections} opciones.`;
  }

  return "Personalizá este plato a tu gusto.";
}
