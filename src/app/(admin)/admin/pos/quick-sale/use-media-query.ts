"use client";

import * as React from "react";

/**
 * ¿La pantalla está en el ancho en el que el panel de venta es **columna** y no sheet?
 *
 * Se lee con `matchMedia` porque la respuesta no es cosmética: cuando el panel de venta es un sheet cerrado
 * hay que sacarlo del árbol accesible (`inert` + `aria-hidden`), y cuando es la columna de la venta no. Una
 * clase responsive no puede decidir eso.
 *
 * Tres cuidados:
 *
 * 1. **El primer render (servidor y jsdom) devuelve `false`**: no hay `window`, y aun habiendo `jsdom` sin
 *    `matchMedia` el hook no puede tirar. `false` es el estado conservador: el panel queda operativo (nunca
 *    `inert` de arranque) y la barra del sheet existe pero no se ve (la esconde CSS).
 * 2. **La lectura real pasa en el efecto**, así que el markup del servidor y el del primer render del cliente
 *    coinciden y la hidratación no se queja.
 * 3. El listener se saca al desmontar y cuando cambia la query.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * El ancho a partir del cual el POS usa el workspace de dos paneles (`lg` de Tailwind = 64rem = 1024 px).
 *
 * Es el mismo número que usan las clases del layout (`lg:grid-cols-[…]`): si cambia una, cambia la otra, y
 * por eso vive en una constante nombrada y no en un literal suelto en dos lugares.
 *
 * **Por qué 1024 y no 768**: a 768 px la barra lateral del panel todavía está en pantalla (264 px), así que
 * al catálogo le quedan ~430 px. Repartir eso en dos columnas deja las tarjetas de producto en ~110 px —
 * ilegibles— y el resultado medido fue peor que apilar. La spec (`SCREEN-POS-QUICK-SALE-001` § *Tablet*)
 * dice exactamente eso: dos paneles **solo si el ancho real lo soporta**; si no, se adopta el patrón de
 * celular (barra + sheet) antes que comprimir los controles. A 1024 px la barra ya se fue y quedan ~740 px.
 */
export const POS_TWO_PANE_QUERY = "(min-width: 64rem)";
