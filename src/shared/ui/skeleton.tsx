import * as React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alto de la pieza. Por defecto, una línea de texto. */
  height?: "text" | "block" | "card";
}

const HEIGHTS: Record<NonNullable<SkeletonProps["height"]>, string> = {
  text: "h-4",
  block: "h-11",
  card: "h-32",
};

/**
 * C1-1 de `plan2uiux.md` — el `Skeleton` que faltaba.
 *
 * El design system pedía "cargando = Skeleton" y no existía: hoy la app tiene **17 literales de
 * "Cargando…"** distintos y un solo `animate-pulse` suelto. Esto es esa pieza, una sola vez.
 *
 * Detalles que importan:
 *
 * - `aria-hidden`: el hueso es decorativo. El estado de carga se anuncia con un `SkeletonAnnouncement`
 *   (o el `role="status"` de la pantalla), no con 6 divs.
 * - `motion-reduce:animate-none`: el pulso se apaga para quien pidió menos movimiento.
 */
export function Skeleton({ height = "text", className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-secondary ${HEIGHTS[height]} w-full ${className}`}
      {...props}
    />
  );
}

interface SkeletonAnnouncementProps {
  /** Qué se está cargando, en palabras ("Cargando locales…"). */
  label: string;
}

/** El texto que anuncia la carga para lectores de pantalla, sin dibujar nada. */
export function SkeletonAnnouncement({ label }: SkeletonAnnouncementProps) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}
