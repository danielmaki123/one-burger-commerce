"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatBusinessHoursSummary } from "@/modules/business-settings/domain/business-hours-format";
import { formatPhoneForDisplay } from "@/modules/business-settings/domain/format-phone";
import type { PublicLocation } from "@/modules/locations/features/list-public-locations/list-public-locations";
import { useCart } from "@/shared/lib/cart";
import {
  useBusinessSettings,
  useCurrencyFormat,
  type BusinessSettingsValue,
} from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { getPublicStartingPrice } from "@/shared/lib/public-product-pricing";
import { buildQuickAddCartItem } from "@/shared/lib/product-quick-add";
import { canQuickAddProduct } from "@/modules/menu/domain/modifier-selection";
import { PublicLocationsList } from "@/shared/ui/public-locations-list";
import { getMenuSearchEmptyState } from "./menu/menu-page-helpers";
import {
  flattenHomeProducts,
  getHomeBrandNameClassName,
  getHomeHeroFrameClassName,
  getHomeHeroLoadingClassName,
  getHomeHeroTitleClassName,
  getHomePageShellClassName,
  getHomePickupEstimateLabel,
  normalizeHomeHeroDescription,
  resolveHomeOpenState,
  searchHomeProducts,
  type HomeCategory,
  type HomeProductCardData,
} from "./home-page-helpers";

type MarketingBlock = {
  id: string;
  type: "promo" | "event" | "combo" | "featured" | "info";
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaType: "none" | "product" | "category" | "url";
  ctaHref: string | null;
};

const POPULAR_PRODUCTS_LIMIT = 4;

function whatsappUrlFor(settings: BusinessSettingsValue): string | null {
  return settings.whatsapp ? `https://wa.me/${settings.whatsapp}` : null;
}

function primaryImageUrl(images: HomeProductCardData["images"] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const primary = images.find((image) => image.isPrimary);
  return (primary ?? images[0]).url;
}

function badgeLabel(type: MarketingBlock["type"], businessName: string): string {
  if (type === "event") return "Evento";
  if (type === "combo") return "Combo";
  if (type === "featured") return "Destacado";
  if (type === "info") return businessName;
  return "Promo";
}

/**
 * Enlace de "Cómo llegar".
 *
 * Se prefiere la URL que el negocio cargó en `/admin/settings`; si no la cargó
 * pero hay dirección, se arma una búsqueda de mapas con esa dirección. Nunca se
 * dibuja un botón que no lleve a ningún lado.
 */
function directionsHref(settings: BusinessSettingsValue): string | null {
  if (settings.mapsUrl) return settings.mapsUrl;

  if (settings.latitude !== null && settings.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`;
  }

  const address = [settings.addressLine, settings.addressReference, settings.city]
    .filter(Boolean)
    .join(", ");

  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

function HeroCta({ block }: { block: MarketingBlock }) {
  const label = block.ctaLabel ?? "Ver detalles";
  const href = block.ctaHref ?? "/menu";
  const inner = (
    <>
      {label}
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </>
  );
  const className =
    "inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-brand px-5 text-label text-brand-foreground shadow-sm transition active:scale-95";

  if (block.ctaType === "url") {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function HeroSlide({ block }: { block: MarketingBlock }) {
  const settings = useBusinessSettings();
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(block.imageUrl) && !imageFailed;

  return (
    <div className="min-w-full shrink-0 snap-center px-0.5">
      <div className={getHomeHeroFrameClassName()}>
        {hasImage ? (
          <img
            src={block.imageUrl ?? undefined}
            alt={block.title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 brand-hero-fallback" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,11,8,0.45)_0%,rgba(13,11,8,0.05)_38%,rgba(13,11,8,0.78)_100%)]" />

        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-7">
          <span className="inline-flex w-fit rounded-full bg-terracotta px-3 py-1 text-label-xs uppercase text-white">
            {badgeLabel(block.type, settings.name)}
          </span>

          <div className="space-y-3">
            <h2
              className={getHomeHeroTitleClassName()}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {block.title}
            </h2>
            {block.description ? (
              <p className="max-w-full break-words text-body-sm text-white/85 sm:max-w-[34ch]">
                {normalizeHomeHeroDescription(block.description)}
              </p>
            ) : null}
            <HeroCta block={block} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta de producto de la grilla: mismo orden que el mock (chip, foto, nombre, precio, "+"). */
function HomeProductCard({ product }: { product: HomeProductCardData }) {
  const currency = useCurrencyFormat();
  const { addItem } = useCart();
  const [imageFailed, setImageFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const thumb = primaryImageUrl(product.images);
  const hasImage = Boolean(thumb) && !imageFailed;
  const quickAdd = canQuickAddProduct(product);

  function handleQuickAdd() {
    addItem(buildQuickAddCartItem(product));
    setJustAdded(true);
  }

  return (
    <article className="group relative flex min-h-44 flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
      {/* Enlace estirado: toda la tarjeta lleva al producto, y el "+" queda por encima */}
      <Link
        href={`/menu/${product.id}`}
        aria-label={`Ver ${product.name}`}
        className="absolute inset-0 z-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />

      <div className="pointer-events-none relative aspect-[4/3] w-full overflow-hidden bg-cream">
        {hasImage ? (
          <img
            src={thumb ?? undefined}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center brand-photo text-brand/40">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
        {/* El chip sale de los datos: la categoría del producto, no un rótulo fijo. */}
        <span className="absolute left-2 top-2 rounded-full bg-card/92 px-2 py-0.5 text-label-xs uppercase text-foreground shadow-sm">
          {product.categoryName}
        </span>
      </div>

      <div className="pointer-events-none relative flex flex-1 flex-col justify-between gap-1.5 p-3">
        <div className="space-y-0.5">
          <p
            className="line-clamp-1 text-title-sm text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {product.name}
          </p>
          {product.description ? (
            <p className="line-clamp-1 text-caption text-muted-foreground">
              {product.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-label text-brand">
            {formatCurrency(getPublicStartingPrice(product), currency)}
          </span>
          {quickAdd ? (
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label={`Agregar ${product.name} al carrito`}
              className="pointer-events-auto relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground transition active:scale-95"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                {justAdded ? (
                  <path d="m5 13 4 4L19 7" />
                ) : (
                  <>
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </>
                )}
              </svg>
            </button>
          ) : (
            // Hay que elegir opciones: la tarjeta entera lleva a la pantalla del producto.
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-brand"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {justAdded ? (
        <span role="status" className="sr-only">
          Agregado al carrito
        </span>
      ) : null}
    </article>
  );
}

export default function PublicHomePage() {
  const settings = useBusinessSettings();
  const whatsappUrl = whatsappUrlFor(settings);
  const phoneDisplay = formatPhoneForDisplay(settings.phone);
  const directions = directionsHref(settings);

  const [marketingBlocks, setMarketingBlocks] = useState<MarketingBlock[]>([]);
  const [categories, setCategories] = useState<HomeCategory[]>([]);
  const [locations, setLocations] = useState<PublicLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  /**
   * De dónde salen los datos operativos del cartel (T8 fase 7): del **local por defecto** o
   * de la configuración si el negocio todavía no cargó ninguno. Leer la configuración con
   * locales cargados dejaría el cartel diciendo "Abierto" mientras el checkout rechaza el
   * pedido.
   *
   * `/api/locations` devuelve solo los activos y ya ordenados, así que el primero es el
   * local por defecto: la misma regla que aplica el servidor (`pickDefaultLocation`).
   */
  const operationalSource = useMemo(() => {
    const location = locations[0] ?? null;

    return {
      hours: location?.businessHours ?? settings.businessHours,
      pickupLeadMinutes: location?.pickupLeadMinutes ?? settings.pickupLeadMinutes,
      isAcceptingOrders: location?.isAcceptingOrders ?? settings.isAcceptingOrders,
      closedMessage: location?.closedMessage ?? settings.closedMessage,
    };
  }, [locations, settings]);

  const hoursSummary = formatBusinessHoursSummary(operationalSource.hours);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    async function fetchHome() {
      try {
        const res = await fetch("/api/menu", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setMarketingBlocks(data.marketingBlocks || []);
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to fetch home data", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchHome();
  }, []);

  /**
   * El local por defecto (T8 fase 7). Es la misma fuente que usa el checkout: si falla o
   * no hay ninguno, el cartel sigue con la configuración en vez de quedarse sin estado.
   */
  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        if (!res.ok) return;

        const payload = (await res.json()) as { data?: PublicLocation[] };
        setLocations(payload.data ?? []);
      } catch {
        // El cartel ya tiene el respaldo de la configuración: no se avisa de nada.
      }
    }

    void fetchLocations();
  }, []);

  /**
   * El estado operativo se calcula con el reloj del cliente y recién en el
   * cliente: en el servidor la hora sería la del build y el cartel mentiría.
   */
  useEffect(() => {
    setNow(new Date());
  }, []);

  const openState = useMemo(
    () =>
      resolveHomeOpenState({
        isAcceptingOrders: operationalSource.isAcceptingOrders,
        closedMessage: operationalSource.closedMessage,
        businessHours: operationalSource.hours,
        timezone: settings.timezone,
        pickupLeadMinutes: operationalSource.pickupLeadMinutes,
        now: now ?? new Date(0),
      }),
    [now, settings.timezone, operationalSource],
  );

  const products = useMemo(() => flattenHomeProducts(categories), [categories]);
  const popularProducts = useMemo(
    () => products.slice(0, POPULAR_PRODUCTS_LIMIT),
    [products],
  );
  const searchResults = useMemo(() => searchHomeProducts(products, query), [products, query]);
  const isSearching = query.trim().length > 0;
  const visibleProducts = isSearching ? searchResults : popularProducts;
  const emptyState = getMenuSearchEmptyState(query);

  const heroCount = marketingBlocks.length;

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  }

  function handleHeroScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth <= 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    const clamped = Math.max(0, Math.min(index, heroCount - 1));
    activeIndexRef.current = clamped;
    setActiveIndex(clamped);
  }

  // Autoplay every 5s; manual swipe y dots siguen funcionando.
  // Respetamos prefers-reduced-motion: si el usuario lo pide, no autoavanza.
  useEffect(() => {
    if (heroCount <= 1) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    const id = window.setInterval(() => {
      scrollToIndex((activeIndexRef.current + 1) % heroCount);
    }, 5000);
    return () => window.clearInterval(id);
  }, [heroCount]);

  const visibleCategories = categories.filter(
    (category) =>
      (category.products?.length ?? 0) > 0 ||
      (category.subcategories ?? []).some((sub) => (sub.products?.length ?? 0) > 0),
  );

  return (
    <div className="brand-canvas min-h-screen">
      <div className={getHomePageShellClassName()}>
        {/* Header: la marca vive en el encabezado del sitio; acá va el estado del local */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={getHomeBrandNameClassName()}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {settings.name}
              </h1>
              <span
                className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-label-xs uppercase ${
                  openState.isOpen
                    ? "bg-success text-success-foreground"
                    : "bg-danger text-danger-foreground"
                }`}
              >
                <span aria-hidden="true">●</span>
                {openState.label}
              </span>
            </div>
            <p className="text-caption text-muted-foreground">
              {openState.detail}
              {settings.city ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span aria-hidden="true">📍</span> {settings.city}
                </>
              ) : null}
              <span aria-hidden="true"> · </span>
              {getHomePickupEstimateLabel({ pickupLeadMinutes: operationalSource.pickupLeadMinutes })}
            </p>
          </div>
        </header>

        {/* Buscador: filtra el menú que ya está cargado, igual que el del menú */}
        <form
          role="search"
          className="relative flex items-center"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="home-search" className="sr-only">
            Buscar en el menú
          </label>
          <span aria-hidden="true" className="absolute left-4 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar en ${settings.name}...`}
            className="min-h-11 w-full rounded-full border border-border bg-card pl-11 pr-24 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          {isSearching ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 min-h-9 rounded-full px-3 text-caption font-semibold text-brand"
            >
              Limpiar
            </button>
          ) : null}
        </form>

        {/* Hero carousel */}
        {heroCount > 0 ? (
          <section aria-label="Promociones y eventos" className="space-y-3">
            <div
              ref={trackRef}
              onScroll={handleHeroScroll}
              className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {marketingBlocks.map((block) => (
                <HeroSlide key={block.id} block={block} />
              ))}
            </div>
            {heroCount > 1 ? (
              <div className="flex justify-center gap-2">
                {marketingBlocks.map((block, index) => (
                  <button
                    key={block.id}
                    type="button"
                    aria-label={`Ir a la promo ${index + 1}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    onClick={() => scrollToIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === activeIndex ? "w-7 bg-brand" : "w-2 bg-border"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : loading ? (
          <div className={getHomeHeroLoadingClassName()}>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
          </div>
        ) : null}

        {/* Categorías */}
        {visibleCategories.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                Categorías
              </h2>
              <Link
                href="/menu"
                className="text-body-sm font-semibold text-brand transition hover:text-brand-strong"
              >
                Ver menú
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleCategories.map((category) => {
                const thumb = primaryImageUrl(
                  flattenHomeProducts([category])[0]?.images,
                );
                return (
                  <Link
                    key={category.id}
                    href={`/menu?category=${encodeURIComponent(category.slug)}`}
                    className="group flex w-[84px] shrink-0 flex-col items-center gap-2"
                  >
                    <div className="h-[72px] w-[72px] overflow-hidden rounded-panel border border-border bg-cream shadow-card">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={category.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand/40">
                          <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-7 w-7"
                          >
                            <path d="M3 11h18" />
                            <path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
                            <path d="M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-1 text-center text-label-sm text-foreground">
                      {category.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Productos: los populares del menú, o los resultados de la búsqueda */}
        {visibleProducts.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-headline-md text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {isSearching ? "Resultados" : "Populares"}
                </h2>
                <p className="text-caption text-muted-foreground">
                  {isSearching
                    ? `${searchResults.length} ${searchResults.length === 1 ? "coincidencia" : "coincidencias"} para “${query.trim()}”`
                    : "Lo más pedido del menú"}
                </p>
              </div>
              <Link
                href="/menu"
                className="text-body-sm font-semibold text-brand transition hover:text-brand-strong"
              >
                Ver más
              </Link>
            </div>
            {isSearching ? (
              <p role="status" className="sr-only">
                {searchResults.length} {searchResults.length === 1 ? "resultado" : "resultados"} para{" "}
                {query.trim()}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <HomeProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : isSearching ? (
          <section className="space-y-1 rounded-card border border-border bg-card p-5 text-center">
            <p className="text-title-sm text-foreground">{emptyState.title}</p>
            <p className="text-caption text-muted-foreground">{emptyState.description}</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 min-h-11 rounded-full bg-brand px-4 text-label text-brand-foreground"
            >
              Limpiar búsqueda
            </button>
          </section>
        ) : null}

        {/* Información del restaurante: datos del admin, con enlaces que funcionan */}
        <section className="space-y-2 pb-2">
          <h2 className="text-headline-md text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Información del restaurante
          </h2>
          <div className="space-y-3 rounded-panel border border-border bg-accent/60 p-4 shadow-card">
            {/* A-07: con sucursales cargadas, la dirección **y el horario** viven en la lista de
                sucursales (salen de `/api/locations`). Antes este bloque los mostraba con los
                datos del negocio: quedaban dos direcciones y dos "Cómo llegar" para el mismo
                lugar, y un horario que no era el del local elegido. Sin sucursales cargadas se
                mantiene el respaldo de la configuración, como antes. */}
            {locations.length === 0 ? (
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-base text-brand"
                >
                  📍
                </span>
                <div className="flex-1 text-caption">
                  <p className="text-label-sm text-foreground">Retiro en tienda</p>
                  <p className="text-muted-foreground">
                    {[settings.addressLine, settings.addressReference, settings.city]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-3 border-t border-border pt-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-base text-brand"
              >
                🕒
              </span>
              <div className="flex-1 text-caption">
                <p className="text-label-sm text-foreground">
                  {locations.length === 0 ? "Horario de atención" : "Contacto"}
                </p>
                {locations.length === 0 ? (
                  <p className="text-muted-foreground">{hoursSummary}</p>
                ) : null}
                {phoneDisplay ? (
                  <p className="mt-0.5 text-muted-foreground">Teléfono: {phoneDisplay}</p>
                ) : null}
              </div>
            </div>

            {(locations.length === 0 && directions) || settings.phone || whatsappUrl ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {locations.length === 0 && directions ? (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-card border border-border bg-card text-label-sm text-foreground shadow-sm transition active:scale-95"
                  >
                    <span aria-hidden="true">🗺️</span> Cómo llegar
                  </a>
                ) : null}
                {settings.phone ? (
                  <a
                    href={`tel:${settings.phone}`}
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-card bg-brand text-label-sm text-brand-foreground shadow-sm transition active:scale-95"
                  >
                    <span aria-hidden="true">📞</span> Llamar
                  </a>
                ) : whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-card bg-brand text-label-sm text-brand-foreground shadow-sm transition active:scale-95"
                  >
                    <span aria-hidden="true">💬</span> WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {locations.length > 0 ? (
          /* A-07: cada sucursal con su propia dirección, su horario y su mapa. Antes acá
             solo se veía el horario y la dirección de la configuración del negocio, que con
             más de un local no le dice al cliente dónde retira. */
          <section className="space-y-2 pb-2">
            <h2
              className="text-headline-md text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Sucursales
            </h2>
            <PublicLocationsList locations={locations} />
          </section>
        ) : null}

        {settings.tagline ? (
          <p className="text-center text-caption italic text-muted-foreground">
            {settings.tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
}
