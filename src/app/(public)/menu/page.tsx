"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  getMenuHeaderCountLabel,
  getMenuSearchEmptyState,
  getInitialCategoryId,
  publicMenuDensityClasses,
  searchPublicMenuProducts,
  shouldShowSubcategoryHeading,
  shouldShowSubcategoryNav,
  shouldShowTopLevelMenuHeading,
} from "./menu-page-helpers";
import { MenuProductCard } from "./menu-product-card";

interface Product {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  images: { url: string; alt: string | null }[];
  modifierGroups?: {
    minSelections?: number | null;
    options?: { priceDelta?: number | null; isActive?: boolean | null }[] | null;
  }[] | null;
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  products: Product[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  products: Product[];
  subcategories?: Subcategory[];
}

function ProductRail({ children }: { children: React.ReactNode }) {
  return (
    <div className={publicMenuDensityClasses.productGrid}>
      {children}
    </div>
  );
}

function MenuSectionHeading({
  title,
}: {
  title: string;
}) {
  return (
    <div className="border-b border-border pb-2">
      <h2
        className="text-xl font-semibold text-foreground md:text-2xl"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h2>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<MenuPageLoadingState />}>
      <MenuPageContent />
    </Suspense>
  );
}

function MenuPageLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-brand" />
        <p className="text-sm">Preparando el menú...</p>
      </div>
    </div>
  );
}

function MenuPageContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const selectedCategorySlug = searchParams.get("category");

  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await fetch("/api/menu", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to fetch menu", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchMenu();
  }, []);

  useEffect(() => {
    setActiveCategory(getInitialCategoryId(categories, selectedCategorySlug));
  }, [categories, selectedCategorySlug]);

  const activeCat = categories.find((c) => c.id === activeCategory);
  const isSearching = searchQuery.trim().length > 0;
  const searchResults = searchPublicMenuProducts(categories, searchQuery);
  const emptySearchState = getMenuSearchEmptyState(searchQuery);
  const headerCountLabel = getMenuHeaderCountLabel({
    categoryCount: categories.length,
    isSearching,
    searchResultCount: searchResults.length,
  });
  const topLevelProducts = activeCat?.products || [];
  const populatedSubcategories = (activeCat?.subcategories || []).filter(
    (subcategory) => subcategory.products?.length > 0,
  );
  const hasSubcategoryNav = shouldShowSubcategoryNav({
    subcategoryCount: populatedSubcategories.length,
  });
  const showTopLevelHeading = shouldShowTopLevelMenuHeading({
    hasSubcategories: populatedSubcategories.length > 0,
  });
  const showSubcategoryHeading = shouldShowSubcategoryHeading();
  const hasVisibleProducts =
    topLevelProducts.length > 0 || populatedSubcategories.length > 0;

  if (loading) {
    return <MenuPageLoadingState />;
  }

  return (
    <div className="min-h-screen brand-canvas">
      <div className={publicMenuDensityClasses.pageShell}>
        <div className="flex items-center justify-between gap-4 px-1">
          <div>
            <h1
              className="text-2xl font-semibold text-foreground md:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Menú
            </h1>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-bold text-brand">
            {headerCountLabel}
          </span>
        </div>
        <label className="relative block px-1">
          <span className="sr-only">Buscar en el menú</span>
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar en el menú"
            className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-base text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
          />
        </label>
        <div className={publicMenuDensityClasses.stickyCategories}>
          <div className="relative -mx-2 overflow-hidden after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-background/95 after:to-transparent">
          <div className={publicMenuDensityClasses.categoryRail} aria-label="Categorías del menú">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={isActive}
                  className={`${publicMenuDensityClasses.categoryChip} ${
                    isActive
                      ? "border-brand bg-brand text-brand-foreground shadow-sm shadow-brand/25"
                      : "border-border bg-card/92 text-foreground hover:border-brand hover:text-brand"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {isSearching ? (
          searchResults.length > 0 ? (
            <section className="space-y-5" aria-live="polite">
              <MenuSectionHeading title={`Resultados para “${searchQuery.trim()}”`} />
              <ProductRail>
                {searchResults.map((product) => (
                  <MenuProductCard
                    key={product.id}
                    product={product}
                    className={publicMenuDensityClasses.productRailItem}
                  />
                ))}
              </ProductRail>
            </section>
          ) : (
            <div className="rounded-[28px] border border-dashed border-border bg-card/80 px-6 py-12 text-center shadow-sm" aria-live="polite">
              <p className="text-lg font-semibold text-foreground">{emptySearchState.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {emptySearchState.description}
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-sm shadow-brand/25 transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {emptySearchState.actionLabel}
              </button>
            </div>
          )
        ) : !hasVisibleProducts ? (
          <div className="rounded-[28px] border border-dashed border-border bg-card/80 px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-foreground">
              No hay productos disponibles en esta categoría.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vuelve más tarde para ver nuevas opciones.
            </p>
          </div>
        ) : (
          <div className={publicMenuDensityClasses.contentStack}>
            {hasSubcategoryNav ? (
              <div className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {populatedSubcategories.map((subcategory) => (
                  <a
                    key={subcategory.id}
                    href={`#${subcategory.slug}`}
                    className="flex h-11 shrink-0 items-center rounded-full border border-border bg-card/90 px-4 text-sm font-medium text-foreground shadow-sm transition hover:border-brand hover:text-brand"
                  >
                    {subcategory.name}
                  </a>
                ))}
              </div>
            ) : null}

            {topLevelProducts.length > 0 ? (
              <section className="space-y-5">
                {showTopLevelHeading ? (
                  <MenuSectionHeading title="Para pedir ahora" />
                ) : null}
                <ProductRail>
                  {topLevelProducts.map((product) => (
                    <MenuProductCard
                      key={product.id}
                      product={product}
                      className={publicMenuDensityClasses.productRailItem}
                    />
                  ))}
                </ProductRail>
              </section>
            ) : null}

            {populatedSubcategories.map((subcategory) => (
              <section
                key={subcategory.id}
                id={subcategory.slug}
                className="scroll-mt-40 space-y-5"
              >
                {showSubcategoryHeading ? (
                  <MenuSectionHeading title={subcategory.name} />
                ) : null}
                <ProductRail>
                  {subcategory.products.map((product) => (
                    <MenuProductCard
                      key={product.id}
                      product={product}
                      className={publicMenuDensityClasses.productRailItem}
                    />
                  ))}
                </ProductRail>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
