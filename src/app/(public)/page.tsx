"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatBusinessHoursSummary } from "@/modules/business-settings/domain/business-hours-format";
import { businessInitials } from "@/modules/business-settings/domain/brand-initials";
import { formatPhoneForDisplay } from "@/modules/business-settings/domain/format-phone";
import {
  useBusinessSettings,
  useCurrencyFormat,
  type BusinessSettingsValue,
} from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { getPublicStartingPrice } from "@/shared/lib/public-product-pricing";
import {
  getHomeHeroFrameClassName,
  getHomeHeroLoadingClassName,
  getHomeHeroTitleClassName,
  getHomePageShellClassName,
  getHomePopularCtaClassName,
  normalizeHomeHeroDescription,
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

type ProductImage = { url: string; alt: string | null; isPrimary?: boolean };
type Product = {
  id: string;
  name: string;
  basePrice: number;
  images: ProductImage[];
  modifierGroups?: {
    minSelections?: number;
    options?: { priceDelta?: number; isActive?: boolean }[];
  }[];
  availability?: { isAvailable: boolean; isActive: boolean };
};
type Subcategory = { id: string; products: Product[] };
type Category = {
  id: string;
  name: string;
  slug: string;
  products: Product[];
  subcategories?: Subcategory[];
};

type HomeQuickAction = {
  href: string;
  label: string;
  helper: string;
  icon: ReactNode;
  external?: boolean;
};

/**
 * Accesos rápidos de la home. El enlace de contacto sale de la configuración
 * del negocio, no de un número escrito acá.
 */
function homeQuickActions(whatsappUrl: string | null): HomeQuickAction[] {
  return [
    {
      href: "/menu",
      label: "Menú",
      helper: "Ver carta",
      icon: (
        <>
          <path d="M4 7h16" />
          <path d="M7 12h10" />
          <path d="M9 17h6" />
        </>
      ),
    },
    {
      href: "/cart",
      label: "Carrito",
      helper: "Confirmar pedido",
      icon: (
        <>
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </>
      ),
    },
    {
      href: whatsappUrl ?? "/menu",
      label: "Contacto",
      helper: "WhatsApp",
      external: whatsappUrl !== null,
      icon: (
        <>
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
        </>
      ),
    },
  ];
}

function whatsappUrlFor(settings: BusinessSettingsValue): string | null {
  return settings.whatsapp ? `https://wa.me/${settings.whatsapp}` : null;
}

function primaryImageUrl(images: ProductImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const primary = images.find((image) => image.isPrimary);
  return (primary ?? images[0]).url;
}

function categoryProducts(category: Category): Product[] {
  return [
    ...(category.products || []),
    ...(category.subcategories || []).flatMap((sub) => sub.products || []),
  ];
}

function isUsableProduct(product: Product): boolean {
  if (!product.availability) return true;
  return product.availability.isActive && product.availability.isAvailable;
}

function badgeLabel(type: MarketingBlock["type"], businessName: string): string {
  if (type === "event") return "Evento";
  if (type === "combo") return "Combo";
  if (type === "featured") return "Destacado";
  if (type === "info") return businessName;
  return "Promo";
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
    "inline-flex w-fit items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition active:scale-95";

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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(43,108,150,0.4),transparent_42%),linear-gradient(150deg,#1d3a4d,#16212a)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,11,8,0.45)_0%,rgba(13,11,8,0.05)_38%,rgba(13,11,8,0.78)_100%)]" />

        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-7">
          <span className="inline-flex w-fit rounded-full bg-terracotta px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
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
              <p className="max-w-full break-words text-sm leading-5 text-white/85 sm:max-w-[34ch]">
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

export default function PublicHomePage() {
  const settings = useBusinessSettings();
  const currency = useCurrencyFormat();
  const whatsappUrl = whatsappUrlFor(settings);
  const phoneDisplay = formatPhoneForDisplay(settings.phone);
  const hoursSummary = formatBusinessHoursSummary(settings.businessHours);

  const [marketingBlocks, setMarketingBlocks] = useState<MarketingBlock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

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

  const popularProducts = useMemo(() => {
    const seen = new Set<string>();
    const collected: Product[] = [];
    for (const category of categories) {
      for (const product of categoryProducts(category)) {
        if (!isUsableProduct(product) || seen.has(product.id)) continue;
        seen.add(product.id);
        collected.push(product);
        if (collected.length >= 4) return collected;
      }
    }
    return collected;
  }, [categories]);

  const visibleCategories = categories.filter(
    (category) => categoryProducts(category).length > 0,
  );

  return (
    <div className="brand-canvas min-h-screen">
      <div className={getHomePageShellClassName()}>
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <p
            className="text-lg font-semibold text-ink-green"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {settings.name}
          </p>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-base font-bold text-brand-foreground">
            {businessInitials(settings.name)}
          </span>
        </header>

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
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Categorías
              </h2>
              <Link
                href="/menu"
                className="text-sm font-semibold text-brand transition hover:text-brand-strong"
              >
                Ver menú
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleCategories.map((category) => {
                const thumb = primaryImageUrl(categoryProducts(category)[0]?.images);
                return (
                  <Link
                    key={category.id}
                    href={`/menu?category=${encodeURIComponent(category.slug)}`}
                    className="group flex w-[84px] shrink-0 flex-col items-center gap-2"
                  >
                    <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl border border-border bg-cream shadow-sm">
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
                    <span className="line-clamp-1 text-center text-xs font-medium text-foreground">
                      {category.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Populares */}
        {popularProducts.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                className="text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Populares
              </h2>
              <Link
                href="/menu"
                className="text-sm font-semibold text-brand transition hover:text-brand-strong"
              >
                Ver más
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {popularProducts.map((product) => {
                const thumb = primaryImageUrl(product.images);
                return (
                  <Link
                    key={product.id}
                    href={`/menu/${product.id}`}
                    className="group flex w-[150px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand/35">
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
                    </div>
                    <div className="space-y-1.5 p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {product.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-brand">
                          {formatCurrency(getPublicStartingPrice(product), currency)}
                        </span>
                        <span
                          aria-hidden="true"
                          className={getHomePopularCtaClassName()}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Accesos rápidos */}
        <section aria-labelledby="quick-actions-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="quick-actions-title"
              className="text-xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Accesos rápidos
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {homeQuickActions(whatsappUrl).map((action) => (
              <QuickAccess
                key={action.label}
                href={action.href}
                external={action.external}
                label={action.label}
                helper={action.helper}
                icon={action.icon}
              />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-1 rounded-[24px] border border-border bg-card/70 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground">
              {businessInitials(settings.name)}
            </span>
            <p
              className="text-base font-semibold text-ink-green"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {settings.name}
            </p>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-brand">
                Dirección
              </dt>
              <dd className="mt-1 text-muted-foreground">
                {[settings.addressLine, settings.city].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-brand">
                Horario
              </dt>
              <dd className="mt-1 text-muted-foreground">{hoursSummary}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-brand">
                WhatsApp
              </dt>
              <dd className="mt-1">
                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {phoneDisplay}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>

          {settings.tagline ? (
            <p className="mt-4 text-center text-xs italic text-muted-foreground">
              {settings.tagline}
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function QuickAccess({
  href,
  label,
  helper,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  helper: string;
  icon: ReactNode;
  external?: boolean;
}) {
  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-sm font-semibold leading-5 text-foreground">
          {label}
        </span>
        <span className="block text-xs leading-4 text-muted-foreground">
          {helper}
        </span>
      </span>
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </>
  );

  const className =
    "group flex min-h-[96px] items-center gap-3 rounded-[20px] border border-border bg-card/95 p-3.5 shadow-[0_10px_24px_-16px_rgba(60,40,20,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-[0_14px_28px_-18px_rgba(43,108,150,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] active:border-brand/45";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} aria-label={label}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {content}
    </Link>
  );
}
