import { Skeleton, SkeletonAnnouncement } from "@/shared/ui/skeleton";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **cargando** de la pantalla.
 *
 * La carga de una pantalla con datos es un `Skeleton`, no un «Cargando…»: los huesos van `aria-hidden` y
 * el anuncio para lectores de pantalla es uno solo, en palabras. Se dibujan las tres piezas que van a
 * aparecer (el estado del turno, el conteo y el bloque de acciones) para que el alto no salte.
 */
export default function CashSkeleton() {
  return (
    <section
      aria-label="Caja del local"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <SkeletonAnnouncement label="Leyendo el estado de la caja…" />
      <Skeleton height="text" className="w-1/3" />
      <Skeleton height="block" className="w-2/3" />
      <Skeleton height="card" />
      <Skeleton height="block" className="w-40" />
    </section>
  );
}
