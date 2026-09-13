/**
 * Encabezado del sitio público, **visible en todos los anchos** (A-08).
 *
 * Antes devolvía `hidden … md:block`: por debajo de `md` el header entero —isotipo y nombre del
 * negocio incluidos— desaparecía, y el owner lo reportó como "el isotipo de One Burger
 * desapareció". Ahora la marca está arriba en las secciones principales, en celular y en
 * escritorio; la navegación de escritorio (Menú y carrito) sigue apareciendo desde `sm`.
 */
export function getPublicHeaderClassName() {
  return "sticky top-0 z-50 w-full border-b border-border bg-background/88 backdrop-blur-md";
}

export function getPublicFooterClassName() {
  return "hidden border-t border-border bg-secondary/60 md:block";
}

export function getPublicMobileInfoFooterClassName() {
  return "hidden";
}

export function shouldRenderPublicMobileBottomNav(pathname: string) {
  return !/^\/menu\/[^/]+$/.test(pathname);
}
