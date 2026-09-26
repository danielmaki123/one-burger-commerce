import { redirect } from "next/navigation";

/**
 * TASK-IA-001 — `/admin/menu` deja de ser un **hub obligatorio**.
 *
 * El owner aprobó que el catálogo se navegue por **entradas hermanas** (Productos, Categorías,
 * Modificadores, Promociones y Contenido) desde el sidebar, así que esta ruta no puede quedar en el medio:
 * un paso de más entre el menú y la pantalla que se quiere usar.
 *
 * Se mantiene la **compatibilidad**: la URL sigue existiendo y manda a la primera entrada del catálogo, así
 * que los bookmarks y los enlaces viejos no se rompen (las rutas profundas tampoco se tocan).
 */
export default function AdminMenuRedirectPage() {
  redirect("/admin/menu/products");
}
