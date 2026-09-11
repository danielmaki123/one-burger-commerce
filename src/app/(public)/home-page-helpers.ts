import { formatTodayHours } from "@/modules/business-settings/domain/business-hours-format";
import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import { resolveOrderAcceptance } from "@/modules/business-settings/domain/order-acceptance";
import { normalizeSearchText } from "@/shared/lib/normalize-search-text";

export function getHomePageShellClassName() {
  return "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-10 pt-4 xl:px-6";
}

export function getHomeHeroFrameClassName() {
  return "relative h-[320px] w-full overflow-hidden rounded-[28px] bg-coal sm:h-[420px] lg:h-[460px]";
}

export function getHomeHeroLoadingClassName() {
  return "flex h-[320px] items-center justify-center rounded-[28px] border border-border bg-card/60 sm:h-[420px] lg:h-[460px]";
}

export function getHomeHeroTitleClassName() {
  // Escala del mock (T1.3): 30 px en celular y 40 px en escritorio, con su
  // interlineado y su peso. Antes eran tres tamaños sueltos en la clase.
  return "max-w-full break-words text-display text-white sm:max-w-[16ch] lg:text-display-lg";
}

/** Nombre del negocio en el encabezado: paso `headline` de la escala del mock. */
export function getHomeBrandNameClassName() {
  return "text-headline text-ink-green";
}

export function normalizeHomeHeroDescription(description: string) {
  return description.replace(
    "Para disfrutar mas la mesa",
    "Para disfrutar más la mesa",
  );
}

export function getHomePopularCtaClassName() {
  return "flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground";
}

/* ── T2: estado operativo, estimado de retiro y tarjetas de producto ── */

export type HomeOpenState = {
  isOpen: boolean;
  /** La palabra que se muestra en el cartel del encabezado. */
  label: "Abierto" | "Cerrado";
  /** Por qué: el horario de hoy, o el mensaje que dejó el negocio. */
  detail: string;
};

/**
 * Estado del local para el encabezado de la home.
 *
 * Usa la **misma** regla que el servidor para aceptar pedidos
 * (`resolveOrderAcceptance`), así que el cartel no puede decir "Abierto"
 * mientras el checkout rechaza el pedido. La diferencia es qué se muestra:
 * fuera del horario lo útil es saber cuándo abre; si el owner pausó los pedidos
 * a propósito, lo útil es su mensaje.
 */
export function resolveHomeOpenState(input: {
  isAcceptingOrders: boolean;
  closedMessage: string | null;
  businessHours: BusinessHours;
  timezone: string;
  pickupLeadMinutes: number;
  now: Date;
}): HomeOpenState {
  const todayHours = formatTodayHours(input.businessHours, input.now, input.timezone);
  const acceptance = resolveOrderAcceptance({ ...input, pickupTime: null });

  if (acceptance.accepted) {
    return { isOpen: true, label: "Abierto", detail: todayHours };
  }

  const configuredMessage = input.closedMessage?.trim();

  return {
    isOpen: false,
    label: "Cerrado",
    detail:
      acceptance.reason === "not-accepting-orders" && configuredMessage
        ? configuredMessage
        : todayHours,
  };
}

/**
 * Estimado de retiro del encabezado.
 *
 * Es el tiempo de preparación que el negocio configura en el admin; sin él no se
 * promete ninguna espera.
 */
export function getHomePickupEstimateLabel({
  pickupLeadMinutes,
}: {
  pickupLeadMinutes: number;
}): string {
  return pickupLeadMinutes > 0
    ? `Retiro: ~${pickupLeadMinutes} min`
    : "Retiro: lo antes posible";
}

export type HomeProductImage = { url: string; alt: string | null; isPrimary?: boolean };

export type HomeProduct = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  packagingFeeAmount?: number | null;
  images?: HomeProductImage[] | null;
  modifierGroups?: {
    isRequired?: boolean | null;
    minSelections?: number | null;
    options?: { priceDelta?: number | null; isActive?: boolean | null }[] | null;
  }[] | null;
  availability?: { isAvailable: boolean; isActive: boolean } | null;
};

export type HomeCategory = {
  id: string;
  name: string;
  slug: string;
  products?: HomeProduct[] | null;
  subcategories?: { products?: HomeProduct[] | null }[] | null;
};

/** Producto del menú con la categoría a la que pertenece (el chip de la tarjeta). */
export type HomeProductCardData = HomeProduct & {
  categoryName: string;
  categorySlug: string;
};

function isOrderableProduct(product: HomeProduct): boolean {
  if (!product.availability) return true;

  return product.availability.isActive && product.availability.isAvailable;
}

/**
 * Aplana el menú público a la lista que usa la home.
 *
 * El mock etiqueta cada tarjeta con copy fijo ("Top #1", "Favorito",
 * "Guarnición"); acá el chip sale de los datos: la categoría del producto.
 */
export function flattenHomeProducts(categories: HomeCategory[]): HomeProductCardData[] {
  const seenIds = new Set<string>();
  const flattened: HomeProductCardData[] = [];

  for (const category of categories) {
    const products = [
      ...(category.products ?? []),
      ...(category.subcategories ?? []).flatMap((subcategory) => subcategory.products ?? []),
    ];

    for (const product of products) {
      if (seenIds.has(product.id) || !isOrderableProduct(product)) continue;

      seenIds.add(product.id);
      flattened.push({
        ...product,
        categoryName: category.name,
        categorySlug: category.slug,
      });
    }
  }

  return flattened;
}

/** Búsqueda del buscador de la home: mismo criterio que el del menú. */
export function searchHomeProducts(
  products: HomeProductCardData[],
  rawQuery: string,
): HomeProductCardData[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  return products.filter((product) =>
    normalizeSearchText(`${product.name} ${product.description ?? ""}`).includes(query),
  );
}
