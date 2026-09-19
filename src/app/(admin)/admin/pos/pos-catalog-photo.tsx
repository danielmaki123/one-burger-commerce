"use client";

import * as React from "react";
import { UtensilsCrossed } from "lucide-react";

import type { ProductImageRecord } from "@/modules/menu/domain/menu.types";

/**
 * La foto de un producto en la tarjeta del mostrador, con su respaldo.
 *
 * La imagen puede **faltar** (un local que todavía no cargó fotos) o **no cargar** (el catálogo real
 * apunta a un host externo, `images.casaantiguanic.com`): en los dos casos la tarjeta muestra el mismo
 * recurso —el ícono de la casa— en vez de un hueco con el texto alternativo suelto.
 *
 * No hay un ícono **por categoría** a propósito: la respuesta del catálogo no trae color ni slug de
 * categoría, y un mapa nombre→ícono sería hardcodear la carta. Es el mismo criterio que la ficha
 * pública, que también cae a un ícono genérico.
 */
export default function PosCatalogPhoto({
  name,
  images,
}: {
  name: string;
  images: ProductImageRecord[];
}) {
  const [failed, setFailed] = React.useState(false);
  const primary = images.find((image) => image.isPrimary) ?? images[0];

  if (!primary || failed) {
    return (
      <div
        data-testid="pos-catalog-photo-fallback"
        aria-hidden="true"
        className="flex h-24 w-full items-center justify-center rounded-stitch-md bg-surface-low"
      >
        <UtensilsCrossed className="h-8 w-8 text-ink-muted" />
      </div>
    );
  }

  return (
    <img
      src={primary.url}
      alt={primary.alt?.trim() ? primary.alt : name}
      className="h-24 w-full rounded-stitch-md object-cover"
      onError={() => setFailed(true)}
    />
  );
}
