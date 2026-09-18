import { redirect } from "next/navigation";

/**
 * Punto 2 del roadmap (2026-09-18) — la sección **Historial** vive en sus dos tabs, y los cierres son
 * la primera: `/admin/history` entra por ahí para que el ítem del sidebar sea uno solo.
 */
export default function AdminHistoryPage() {
  redirect("/admin/history/cierres");
}
