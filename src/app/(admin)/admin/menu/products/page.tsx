"use client";

import * as React from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import {
  AdminCompactToolbar,
  AdminEmptyState,
  AdminPageHeader,
} from "../../_components/admin-operational-ui";
import {
  countActiveProductFilters,
  countProductsByCategory,
  type AdminProduct,
  type AdminProductCategory,
  type ProductFilterState,
} from "./product-list-helpers";
import ProductDishCard from "./product-dish-card";

type StatusFilter = ProductFilterState["status"];
type AvailabilityFilter = ProductFilterState["availability"];

const UNCATEGORIZED = "__uncategorized__";
const SELECT_CLASS =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export default function ProductsPage() {
  const [products, setProducts] = React.useState<AdminProduct[]>([]);
  const [categories, setCategories] = React.useState<AdminProductCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<{ message: string; requiresLogin: boolean } | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [showArchivedSuccess, setShowArchivedSuccess] = React.useState(false);

  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("active");
  const [availabilityFilter, setAvailabilityFilter] = React.useState<AvailabilityFilter>("all");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const loadProducts = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch("/api/admin/menu/products"),
        fetch("/api/admin/menu/categories"),
      ]);
      const failedResponse = [productsRes, categoriesRes].find((response) => !response.ok);
      if (failedResponse) {
        if (failedResponse.status === 401) {
          setLoadError({
            message: "Tu sesión expiró. Inicia sesión para volver a cargar los productos.",
            requiresLogin: true,
          });
          return;
        }
        throw new Error("No se pudo cargar el catálogo. Intenta nuevamente.");
      }

      const [productsJson, categoriesJson] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
      ]);
      setProducts(productsJson.data || []);
      setCategories(categoriesJson.data || []);
    } catch (error) {
      setLoadError({
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el catálogo. Intenta nuevamente.",
        requiresLogin: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts, reloadKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setShowArchivedSuccess(params.get("archived") === "1");
  }, []);

  const orderedCategories = React.useMemo(
    () =>
      [...categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [categories],
  );

  const categoryNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  // Predicados de filtro reutilizables (faceted): cada chip cuenta contra el
  // resto de filtros activos, no contra sí mismo.
  const matchesSearch = React.useCallback(
    (p: AdminProduct) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q);
    },
    [search],
  );
  const matchesStatus = React.useCallback(
    (p: AdminProduct) =>
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? p.availability.isActive
          : !p.availability.isActive,
    [statusFilter],
  );
  const matchesAvailability = React.useCallback(
    (p: AdminProduct) =>
      availabilityFilter === "all"
        ? true
        : availabilityFilter === "available"
          ? p.availability.isAvailable
          : !p.availability.isAvailable,
    [availabilityFilter],
  );
  const matchesCategory = React.useCallback(
    (p: AdminProduct) =>
      categoryFilter === "all"
        ? true
        : categoryFilter === UNCATEGORIZED
          ? !p.categoryId || !categoryNameById.has(p.categoryId)
          : p.categoryId === categoryFilter,
    [categoryFilter, categoryNameById],
  );

  const filtered = React.useMemo(
    () =>
      products.filter(
        (p) =>
          matchesSearch(p) &&
          matchesStatus(p) &&
          matchesAvailability(p) &&
          matchesCategory(p),
      ),
    [products, matchesSearch, matchesStatus, matchesAvailability, matchesCategory],
  );

  // Conteos faceted para chips: categorías contra búsqueda + estado;
  // "Agotados" contra búsqueda + estado + categoría.
  const chipBase = React.useMemo(
    () => products.filter((p) => matchesSearch(p) && matchesStatus(p)),
    [products, matchesSearch, matchesStatus],
  );
  const knownCategoryIds = React.useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  );
  const categoryCounts = React.useMemo(
    () => countProductsByCategory(chipBase, knownCategoryIds),
    [chipBase, knownCategoryIds],
  );
  const agotadosCount = React.useMemo(
    () => chipBase.filter((p) => matchesCategory(p) && !p.availability.isAvailable).length,
    [chipBase, matchesCategory],
  );

  const activeFilterCount = countActiveProductFilters({
    category: categoryFilter,
    status: statusFilter,
    availability: availabilityFilter,
  });
  const hasFiltersToClear = activeFilterCount > 0 || search.trim().length > 0;

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("active");
    setAvailabilityFilter("all");
  };

  const handleProductUpdated = React.useCallback((updatedProduct: AdminProduct) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === updatedProduct.id ? updatedProduct : product,
      ),
    );
  }, []);

  const renderDish = (product: AdminProduct) => (
    <ProductDishCard key={product.id} product={product} onUpdated={handleProductUpdated} />
  );

  const renderChip = (options: {
    id: string;
    label: string;
    count: number;
    active: boolean;
    onSelect: () => void;
    danger?: boolean;
  }) => (
    <button
      key={options.id}
      type="button"
      aria-pressed={options.active}
      onClick={options.onSelect}
      className={[
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none",
        options.active
          ? options.danger
            ? "bg-status-alerta text-white"
            : "bg-brand text-brand-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent",
      ].join(" ")}
    >
      <span>{options.label}</span>
      <span
        className={[
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums",
          options.active ? "bg-white/20 text-inherit" : "bg-card text-muted-foreground",
        ].join(" ")}
      >
        {options.count}
      </span>
    </button>
  );

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        title="Productos"
        description="Catálogo por categoría, estado y disponibilidad."
        actions={
          <Link href="/admin/menu/products/new">
            <Button>Nuevo producto</Button>
          </Link>
        }
      />

      {showArchivedSuccess && (
        <Card className="border-success-strong/25 bg-success p-4 text-sm text-success-foreground">
          Producto archivado. Ya no aparece en el menú público.
        </Card>
      )}

      <AdminCompactToolbar>
        <div className="min-w-0 space-y-3">
          <Input
            label="Buscar productos"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 gap-2 sm:flex-none"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="product-filters"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{filtersOpen ? "Ocultar filtros" : "Filtros"}</span>
              {activeFilterCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            {hasFiltersToClear ? (
              <Button type="button" variant="ghost" className="min-h-11" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : null}
          </div>

          {filtersOpen ? (
            <div
              id="product-filters"
              aria-label="Filtros de productos"
              className="grid gap-3 border-t border-border pt-3 md:grid-cols-2"
            >
              <label className="min-w-0 space-y-1.5 text-sm font-medium text-foreground">
                <span>Estado</span>
                <select
                  className={SELECT_CLASS}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="all">Todos</option>
                </select>
              </label>

              <label className="min-w-0 space-y-1.5 text-sm font-medium text-foreground">
                <span>Disponibilidad</span>
                <select
                  className={SELECT_CLASS}
                  value={availabilityFilter}
                  onChange={(event) =>
                    setAvailabilityFilter(event.target.value as AvailabilityFilter)
                  }
                >
                  <option value="all">Todas</option>
                  <option value="available">Disponibles</option>
                  <option value="unavailable">No disponibles</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </AdminCompactToolbar>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">Cargando productos...</div>
      ) : loadError ? (<AdminEmptyState
          title="No se pudo cargar el catálogo"
          description={loadError.message}
          action={
            loadError.requiresLogin ? (
              <Link href="/admin/login">
                <Button variant="outline">Iniciar sesión</Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                Reintentar
              </Button>
            )
          }
        />
      ) : products.length === 0 ? (
        <AdminEmptyState
          title="No se encontraron productos"
          description="Crea el primer producto del menú."
          action={
            <Link href="/admin/menu/products/new">
              <Button variant="ghost">Crear producto</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div aria-label="Categorías del menú" className="flex flex-wrap items-center gap-2">
            {renderChip({
              id: "all",
              label: "Todos",
              count: categoryCounts.total,
              active: categoryFilter === "all",
              onSelect: () => setCategoryFilter("all"),
            })}
            {orderedCategories.map((category) =>
              renderChip({
                id: category.id,
                label: category.name,
                count: categoryCounts.byCategory.get(category.id) ?? 0,
                active: categoryFilter === category.id,
                onSelect: () => setCategoryFilter(category.id),
              }),
            )}
            {categoryCounts.uncategorized > 0
              ? renderChip({
                  id: UNCATEGORIZED,
                  label: "Sin categoría",
                  count: categoryCounts.uncategorized,
                  active: categoryFilter === UNCATEGORIZED,
                  onSelect: () => setCategoryFilter(UNCATEGORIZED),
                })
              : null}
            {renderChip({
              id: "agotados",
              label: "Agotados",
              count: agotadosCount,
              active: availabilityFilter === "unavailable",
              onSelect: () =>
                setAvailabilityFilter((current) =>
                  current === "unavailable" ? "all" : "unavailable",
                ),
              danger: true,
            })}
          </div>

          {filtered.length === 0 ? (
            <AdminEmptyState
              title="Sin resultados para estos filtros"
              description="Ajusta categoría, estado, disponibilidad o búsqueda."
            />
          ) : (
            <div
              aria-label="Platos del menú"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
              {filtered.map(renderDish)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
