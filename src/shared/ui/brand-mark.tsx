import * as React from "react";

import {
  resolveBrandImageUrl,
  type BrandAssets,
  type BrandImageVariant,
} from "@/modules/business-settings/domain/brand-assets";
import { businessInitials } from "@/modules/business-settings/domain/brand-initials";

type BrandMarkProps = {
  brand: BrandAssets;
  /** `mark` = isotipo (header, admin); `full` = logo completo (footer, confirmaciones). */
  variant?: BrandImageVariant;
  /** Clases para la imagen cuando hay logo. */
  className?: string;
  /** Clases para el recuadro de iniciales cuando no hay logo. */
  fallbackClassName?: string;
};

/**
 * Marca del negocio: el logo configurado o, si todavía no hay, las iniciales del
 * nombre. Es el único lugar que decide esto, así que cambiar el logo en el admin
 * se ve en toda la aplicación (público, admin, confirmaciones y PWA).
 */
export function BrandMark({
  brand,
  variant = "mark",
  className,
  fallbackClassName,
}: BrandMarkProps) {
  const imageUrl = resolveBrandImageUrl(brand, variant);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className={className ?? "h-9 w-9 shrink-0 rounded-xl object-cover md:h-10 md:w-10"}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={
        fallbackClassName ??
        className ??
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground md:h-10 md:w-10"
      }
    >
      {businessInitials(brand.name)}
    </span>
  );
}
