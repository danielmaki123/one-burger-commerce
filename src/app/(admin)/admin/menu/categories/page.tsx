"use client";

import * as React from "react";
import { ArrowRightLeft, ChevronDown, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  AdminEmptyState,
  AdminPageHeader,
} from "../../_components/admin-operational-ui";
import AdminEditSheet from "../../_components/admin-edit-sheet";
import {
  countCategoryProducts,
  findCategoryAttention,
  pluralEs,
  type AdminCategory,
  type AdminSubcategory,
} from "./category-list-helpers";

type EditForm = {
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

type SheetTarget =
  | { kind: "new-category" }
  | { kind: "category"; category: AdminCategory }
  | { kind: "new-subcategory"; category: AdminCategory }
  | { kind: "subcategory"; category: AdminCategory; subcategory: AdminSubcategory };

type Feedback = { type: "success" | "error"; message: string };

const emptyForm: EditForm = { name: "", slug: "", sortOrder: 0, isActive: true };

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function autoSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}

export default function CategoriesPage() {
  const [categories, setCategories] = React.useState<AdminCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [sheetTarget, setSheetTarget] = React.useState<SheetTarget | null>(null);
  const [editFormData, setEditFormData] = React.useState<EditForm>(emptyForm);
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [expandedCategoryIds, setExpandedCategoryIds] = React.useState<Set<string>>(() => new Set());
  const [movingSubcategory, setMovingSubcategory] = React.useState<AdminSubcategory | null>(null);
  const [moveDestinationId, setMoveDestinationId] = React.useState("");
  const [isMoving, setIsMoving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const moveDialogRef = React.useRef<HTMLDivElement | null>(null);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/menu/categories");
      if (!response.ok) throw new Error("No se pudo cargar la estructura del menú. Intenta nuevamente.");

      const json = await response.json();
      setCategories(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "No se pudieron cargar las categorías.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchCategories();
  }, [fetchCategories, reloadKey]);

  React.useEffect(() => {
    if (!movingSubcategory) return;

    moveDialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isMoving) {
        setMovingSubcategory(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMoving, movingSubcategory]);

  const openSheet = (target: SheetTarget) => {
    setConfirmingArchive(false);
    setSheetTarget(target);
    if (target.kind === "category") {
      const { category } = target;
      setEditFormData({
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      });
    } else if (target.kind === "subcategory") {
      const { subcategory } = target;
      setEditFormData({
        name: subcategory.name,
        slug: subcategory.slug,
        sortOrder: subcategory.sortOrder,
        isActive: subcategory.isActive,
      });
    } else {
      setEditFormData(emptyForm);
    }
  };

  const closeSheet = () => {
    if (isSaving) return;
    setSheetTarget(null);
    setConfirmingArchive(false);
    setEditFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!sheetTarget) return;
    setIsSaving(true);
    try {
      let response: Response;
      if (sheetTarget.kind === "new-category") {
        response = await fetch("/api/admin/menu/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editFormData.name,
            slug: editFormData.slug,
            sortOrder: editFormData.sortOrder,
            isActive: true,
          }),
        });
      } else if (sheetTarget.kind === "new-subcategory") {
        response = await fetch("/api/admin/menu/subcategories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editFormData.name,
            slug: editFormData.slug,
            sortOrder: editFormData.sortOrder,
            categoryId: sheetTarget.category.id,
            isActive: true,
          }),
        });
      } else if (sheetTarget.kind === "category") {
        response = await fetch(`/api/admin/menu/categories/${sheetTarget.category.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editFormData),
        });
      } else {
        response = await fetch(`/api/admin/menu/subcategories/${sheetTarget.subcategory.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editFormData),
        });
      }

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: getErrorMessage(await response.json(), "No se pudo guardar. Intenta nuevamente."),
        });
        return;
      }

      const isNew = sheetTarget.kind.startsWith("new-");
      setFeedback({
        type: "success",
        message: isNew ? "Creado correctamente." : "Cambios guardados.",
      });
      setSheetTarget(null);
      setEditFormData(emptyForm);
      await fetchCategories();
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar. Revisa tu conexión." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!sheetTarget || (sheetTarget.kind !== "category" && sheetTarget.kind !== "subcategory")) {
      return;
    }

    setIsSaving(true);
    try {
      const url =
        sheetTarget.kind === "category"
          ? `/api/admin/menu/categories/${sheetTarget.category.id}`
          : `/api/admin/menu/subcategories/${sheetTarget.subcategory.id}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!response.ok) {
        setFeedback({ type: "error", message: "No se pudo archivar. Intenta nuevamente." });
        return;
      }

      setFeedback({ type: "success", message: "Archivado. Ya no aparece en la carta pública." });
      setSheetTarget(null);
      setConfirmingArchive(false);
      await fetchCategories();
    } catch {
      setFeedback({ type: "error", message: "No se pudo archivar. Revisa tu conexión." });
    } finally {
      setIsSaving(false);
    }
  };

  const openMoveDialog = (subcategory: AdminSubcategory) => {
    const firstDestination = categories.find((category) => category.id !== subcategory.categoryId);
    setMovingSubcategory(subcategory);
    setMoveDestinationId(firstDestination?.id ?? "");
  };

  const handleMoveSubcategory = async () => {
    if (!movingSubcategory || !moveDestinationId) return;

    setIsMoving(true);
    try {
      const response = await fetch(`/api/admin/menu/subcategories/${movingSubcategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: moveDestinationId }),
      });
      if (!response.ok) {
        setFeedback({ type: "error", message: getErrorMessage(await response.json(), "No se pudo mover la subcategoría.") });
        return;
      }

      const result = await response.json();
      const movedProducts = typeof result.meta?.movedProducts === "number" ? result.meta.movedProducts : 0;
      setMovingSubcategory(null);
      setFeedback({
        type: "success",
        message: `Subcategoría movida. ${pluralEs(movedProducts, "plato reasignado", "platos reasignados")} a la categoría destino.`,
      });
      await fetchCategories();
    } catch {
      setFeedback({ type: "error", message: "No se pudo mover la subcategoría." });
    } finally {
      setIsMoving(false);
    }
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCategories = categories.filter((category) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && category.isActive) ||
      (statusFilter === "inactive" && !category.isActive);
    const matchesQuery =
      !normalizedQuery ||
      category.name.toLocaleLowerCase().includes(normalizedQuery) ||
      category.slug.toLocaleLowerCase().includes(normalizedQuery) ||
      category.subcategories.some((subcategory) =>
        subcategory.name.toLocaleLowerCase().includes(normalizedQuery),
      );
    return matchesStatus && matchesQuery;
  });

  const activeCount = categories.filter((category) => category.isActive).length;
  const totalProducts = categories.reduce((sum, category) => sum + countCategoryProducts(category), 0);
  const attentionItems = React.useMemo(() => findCategoryAttention(categories), [categories]);
  const moveDestination = categories.find((category) => category.id === moveDestinationId);

  const sheetTitle =
    sheetTarget?.kind === "new-category"
      ? "Nueva categoría"
      : sheetTarget?.kind === "category"
        ? sheetTarget.category.name
        : sheetTarget?.kind === "new-subcategory"
          ? `Nueva subcategoría en ${sheetTarget.category.name}`
          : sheetTarget?.kind === "subcategory"
            ? sheetTarget.subcategory.name
            : "";

  const sheetKicker =
    sheetTarget?.kind === "new-category"
      ? "Catálogo"
      : sheetTarget?.kind === "category"
        ? "Editar categoría"
        : sheetTarget?.kind === "new-subcategory"
          ? "Jerarquía del catálogo"
          : sheetTarget?.kind === "subcategory"
            ? "Editar subcategoría"
            : undefined;

  const canArchive =
    sheetTarget?.kind === "category"
      ? sheetTarget.category.isActive
      : sheetTarget?.kind === "subcategory"
        ? sheetTarget.subcategory.isActive
        : false;

  const archiveSubject = sheetTarget?.kind === "category" ? "la categoría" : "la subcategoría";

  const renderChip = (id: string, label: string, count: number, active: boolean, onSelect: () => void) => (
    <button
      key={id}
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={[
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none",
        active ? "bg-brand text-brand-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums",
          active ? "bg-white/20 text-inherit" : "bg-card text-muted-foreground",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Catálogo"
        title="Categorías"
        description="El orden de la carta pública. Toca una categoría para editarla o expandir sus subcategorías."
        actions={
          <Button type="button" className="min-h-11 gap-2" onClick={() => openSheet({ kind: "new-category" })}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nueva categoría
          </Button>
        }
      />

      {feedback ? (
        <div
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-success-strong/30 bg-success text-success-foreground"
              : "border-danger-strong/30 bg-danger text-danger-foreground"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!loading && !loadError && attentionItems.length > 0 ? (
        <section
          aria-label="Necesita atención"
          className="overflow-hidden rounded-xl border border-border border-l-[3px] border-l-status-preparando bg-card"
        >
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-warning-foreground">
              Necesita atención
            </p>
            <p className="font-mono text-xs font-bold text-warning-foreground">
              {attentionItems.length}
            </p>
          </div>
          {attentionItems.map((item) => (
            <button
              key={item.categoryId}
              type="button"
              onClick={() => {
                setExpandedCategoryIds((current) => new Set(current).add(item.categoryId));
                document
                  .getElementById(`category-row-${item.categoryId}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="flex min-h-12 w-full items-center gap-3 border-t border-border px-4 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand motion-reduce:transition-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-brand-strong">Revisar →</span>
            </button>
          ))}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar por estado">
        {renderChip("all", "Todas", categories.length, statusFilter === "all", () => setStatusFilter("all"))}
        {renderChip("active", "Activas", activeCount, statusFilter === "active", () => setStatusFilter("active"))}
        {renderChip("inactive", "Inactivas", categories.length - activeCount, statusFilter === "inactive", () => setStatusFilter("inactive"))}
        <div className="min-w-44 flex-1">
          <Input
            label="Buscar categoría o subcategoría"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. cervezas, mariscos…"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          Cargando categorías…
        </div>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudo cargar la estructura del menú"
          description={loadError}
          action={
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setReloadKey((key) => key + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : visibleCategories.length === 0 ? (
        <AdminEmptyState
          title={categories.length === 0 ? "No hay categorías creadas" : "No hay resultados"}
          description={
            categories.length === 0
              ? "Crea la primera categoría para ordenar la carta pública."
              : "Prueba otra búsqueda o cambia el filtro de estado."
          }
          action={
            categories.length === 0 ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => openSheet({ kind: "new-category" })}>
                Crear categoría
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Listado de categorías">
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Orden de la carta
            </p>
            <p className="font-mono text-[11px] font-bold text-muted-foreground">
              {pluralEs(categories.length, "categoría", "categorías")} · {pluralEs(totalProducts, "plato", "platos")}
            </p>
          </div>

          {visibleCategories.map((category) => {
            const isExpanded = expandedCategoryIds.has(category.id);
            const matchingSubcategories = category.subcategories.filter((subcategory) =>
              !normalizedQuery || subcategory.name.toLocaleLowerCase().includes(normalizedQuery),
            );
            const categoryProducts = countCategoryProducts(category);

            return (
              <article key={category.id} id={`category-row-${category.id}`}>
                <div
                  className={`grid grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-2 border-t border-border px-4 py-2 ${
                    isExpanded ? "bg-accent/50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openSheet({ kind: "category", category })}
                        aria-label={`Editar ${category.name}`}
                        className={`min-h-11 text-left text-[15px] font-semibold underline-offset-4 hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          category.isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {category.name}
                      </button>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${
                          category.isActive
                            ? "bg-success text-success-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {category.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {category.subcategories.length === 0
                        ? "Sin subcategorías — los platos se muestran sueltos"
                        : pluralEs(category.subcategories.length, "subcategoría", "subcategorías")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[15px] font-bold tabular-nums text-foreground">{categoryProducts}</p>
                    <p className="text-[11px] text-muted-foreground">{categoryProducts === 1 ? "plato" : "platos"}</p>
                  </div>

                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`subcategory-list-${category.id}`}
                    aria-label={`${isExpanded ? "Ocultar" : "Ver"} subcategorías de ${category.name}`}
                    onClick={() => toggleCategoryExpansion(category.id)}
                    className="-mr-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
                  >
                    {isExpanded ? (
                      <ChevronDown aria-hidden="true" className="h-4.5 w-4.5" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>

                {isExpanded ? (
                  <div id={`subcategory-list-${category.id}`} className="relative border-t border-border bg-secondary/40">
                    <span aria-hidden="true" className="absolute bottom-2 left-7 top-2 w-px bg-border" />
                    {matchingSubcategories.length === 0 ? (
                      <p className="py-3 pl-10 pr-4 text-sm text-muted-foreground">
                        {category.subcategories.length === 0
                          ? "Sin subcategorías. Añade la primera para ordenar estos platos."
                          : "Sin subcategorías que coincidan con la búsqueda."}
                      </p>
                    ) : (
                      matchingSubcategories.map((subcategory) => (
                        <div
                          key={subcategory.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border py-1.5 pl-10 pr-4 first:border-t-0"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openSheet({ kind: "subcategory", category, subcategory })}
                              aria-label={`Editar ${subcategory.name}`}
                              className="min-h-11 text-left text-sm font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              {subcategory.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {subcategory.isActive ? "Activa" : "Inactiva"} · orden {subcategory.sortOrder} en la carta
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="mr-1 text-xs tabular-nums text-muted-foreground">
                              {pluralEs(subcategory.productCount ?? 0, "plato", "platos")}
                            </span>
                            <button
                              type="button"
                              onClick={() => openMoveDialog(subcategory)}
                              aria-label={`Mover ${subcategory.name} a otra categoría`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-brand-strong transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
                            >
                              <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    <div className="border-t border-border py-1.5 pl-10 pr-4">
                      <button
                        type="button"
                        onClick={() => openSheet({ kind: "new-subcategory", category })}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-brand-strong transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
                      >
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        Añadir subcategoría
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      <AdminEditSheet
        open={sheetTarget !== null}
        onClose={closeSheet}
        kicker={sheetKicker}
        title={sheetTitle}
        footer={
          confirmingArchive ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={isSaving} onClick={() => setConfirmingArchive(false)}>
                Conservar
              </Button>
              <Button type="button" variant="danger" className="min-h-11 flex-1" disabled={isSaving} onClick={() => void handleArchive()}>
                {isSaving ? "Archivando…" : "Archivar"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {canArchive ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 text-warning-foreground"
                  disabled={isSaving}
                  onClick={() => setConfirmingArchive(true)}
                >
                  Archivar
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={isSaving} onClick={closeSheet}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={isSaving || !editFormData.name.trim() || !editFormData.slug.trim()}
                onClick={() => void handleSave()}
              >
                {isSaving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          )
        }
      >
        {confirmingArchive ? (
          <div className="rounded-xl border-l-[3px] border-l-warning-foreground bg-warning p-4">
            <p className="text-sm leading-6 text-warning-foreground">
              <strong>¿Archivar {archiveSubject} “{editFormData.name}”?</strong> Dejará de aparecer en la
              carta pública. Los platos no se borran ni pierden historial; puedes reactivarla cuando quieras.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <Input
              label="Nombre"
              placeholder="Ej. Bebidas"
              value={editFormData.name}
              onChange={(event) => {
                const name = event.target.value;
                setEditFormData((current) => ({ ...current, name, slug: autoSlug(name) }));
              }}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Slug"
                placeholder="bebidas"
                value={editFormData.slug}
                onChange={(event) => setEditFormData((current) => ({ ...current, slug: event.target.value }))}
                required
              />
              <Input
                label="Orden en la carta"
                type="number"
                min="0"
                value={editFormData.sortOrder}
                onChange={(event) =>
                  setEditFormData((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              El slug se usa en la URL del menú público.
            </p>
            {sheetTarget?.kind === "category" || sheetTarget?.kind === "subcategory" ? (
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Estado
                <select
                  value={editFormData.isActive ? "active" : "inactive"}
                  onChange={(event) =>
                    setEditFormData((current) => ({ ...current, isActive: event.target.value === "active" }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="active">Activa — visible en la carta</option>
                  <option value="inactive">Inactiva — archivada, no visible</option>
                </select>
              </label>
            ) : null}
          </div>
        )}
      </AdminEditSheet>

      {movingSubcategory ? (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40 p-4 backdrop-blur-[1px] sm:items-center sm:justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !isMoving) setMovingSubcategory(null); }}>
          <div ref={moveDialogRef} role="dialog" aria-modal="true" aria-labelledby="move-subcategory-title" tabIndex={-1} className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl focus:outline-none">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Jerarquía del catálogo</p>
            <h2 id="move-subcategory-title" className="mt-1 font-heading text-lg font-bold text-foreground">
              Mover “{movingSubcategory.name}”
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              La subcategoría y {pluralEs(movingSubcategory.productCount ?? 0, "su plato", "sus platos")} pasarán
              a la categoría elegida. El cambio es atómico.
            </p>
            <label className="mt-5 grid gap-1.5 text-sm font-medium text-foreground">
              Categoría destino
              <select value={moveDestinationId} onChange={(event) => setMoveDestinationId(event.target.value)} disabled={isMoving} className={SELECT_CLASS}>
                {categories.filter((category) => category.id !== movingSubcategory.categoryId).map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11" disabled={isMoving} onClick={() => setMovingSubcategory(null)}>
                Cancelar
              </Button>
              <Button type="button" className="min-h-11 gap-2" disabled={!moveDestinationId || isMoving} onClick={() => void handleMoveSubcategory()}>
                <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
                {isMoving ? "Moviendo…" : `Confirmar movimiento${moveDestination ? ` a ${moveDestination.name}` : ""}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
