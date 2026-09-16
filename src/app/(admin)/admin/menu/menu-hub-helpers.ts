import type { MenuMarketingBlockRecord } from "@/modules/menu/domain/menu.types";

import { getMarketingDisplayStatus } from "./marketing-blocks/marketing-block-helpers";

/** Cuántos bloques del hero entran en la vista previa del hub. */
export const MENU_HUB_PREVIEW_BLOCKS = 3;

export type MenuHubSummary = {
  categories: number;
  subcategories: number;
  products: number;
  unavailable: number;
  modifierGroups: number;
  activePromotions: number;
  /** Bloques del hero visibles hoy (sin recortar). */
  activeBlocks: number;
  /** Porcentaje entero de productos activos con stock. */
  stockPercent: number;
  /** Bloques del hero visibles hoy, en orden de prioridad y recortados a la vista previa. */
  visiblePromotions: MenuMarketingBlockRecord[];
};

type MenuHubInput = {
  categories: Array<{ isActive: boolean }>;
  subcategories: unknown[];
  activeProducts: Array<{ availability: { isAvailable: boolean } }>;
  modifierGroups: unknown[];
  marketingBlocks: MenuMarketingBlockRecord[];
  promotions: Array<{ status: string }>;
};

/**
 * La visibilidad del hero se decide con la regla de `marketing-block-helpers`, que trabaja con las
 * fechas ya serializadas del cliente; acá el registro viene de Prisma, así que se pasan a ISO.
 */
function isVisibleToday(block: MenuMarketingBlockRecord, nowMs: number): boolean {
  return (
    getMarketingDisplayStatus(
      {
        isActive: block.isActive,
        startsAt: block.startsAt ? block.startsAt.toISOString() : null,
        endsAt: block.endsAt ? block.endsAt.toISOString() : null,
      },
      nowMs,
    ) === "active"
  );
}

/**
 * Los números del hub de Menú (`/admin/menu`).
 *
 * Es una lectura de pantalla: no decide nada del catálogo. Las categorías cuentan solo las activas
 * —igual que el catálogo público—, el stock es la proporción de productos activos que se pueden
 * pedir, las promos usables salen del mismo cálculo que el checkout (`list-promotions`) y los bloques
 * del hero se filtran con la regla de visibilidad de `marketing-block-helpers`.
 */
export function summarizeMenuHub(input: MenuHubInput, nowMs: number): MenuHubSummary {
  const products = input.activeProducts.length;
  const unavailable = input.activeProducts.filter(
    (product) => !product.availability.isAvailable,
  ).length;

  const visibleToday = input.marketingBlocks
    .filter((block) => isVisibleToday(block, nowMs))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    categories: input.categories.filter((category) => category.isActive).length,
    subcategories: input.subcategories.length,
    products,
    unavailable,
    modifierGroups: input.modifierGroups.length,
    activePromotions: input.promotions.filter((promo) => promo.status === "active").length,
    activeBlocks: visibleToday.length,
    stockPercent: products === 0 ? 0 : Math.round(((products - unavailable) / products) * 100),
    visiblePromotions: visibleToday.slice(0, MENU_HUB_PREVIEW_BLOCKS),
  };
}
