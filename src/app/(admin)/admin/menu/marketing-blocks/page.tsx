"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  AdminEmptyState,
  AdminPageHeader,
} from "../../_components/admin-operational-ui";
import AdminEditSheet from "../../_components/admin-edit-sheet";
import {
  describeMarketingCta,
  describeMarketingWindow,
  getMarketingDisplayStatus,
  MARKETING_STATUS_LABELS,
  MARKETING_TYPE_LABELS,
  type MarketingBlockCtaType,
  type MarketingBlockType,
  type MarketingDisplayStatus,
} from "./marketing-block-helpers";
import { pluralEs } from "../categories/category-list-helpers";

type MarketingBlock = {
  id: string;
  type: MarketingBlockType;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaType: MarketingBlockCtaType;
  ctaTarget: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

type ProductOption = {
  id: string;
  name: string;
  availability: {
    isActive: boolean;
  };
};

type FormState = {
  type: MarketingBlockType;
  title: string;
  description: string;
  imageUrl: string;
  ctaLabel: string;
  ctaType: MarketingBlockCtaType;
  ctaTarget: string;
  isActive: boolean;
  sortOrder: number;
  startsAt: string;
  endsAt: string;
};

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-line-subtle bg-surface-card px-3 text-st-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

const STATUS_FILTERS: { id: "all" | MarketingDisplayStatus; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "scheduled", label: "Programados" },
  { id: "inactive", label: "Inactivos" },
];

function createEmptyForm(): FormState {
  return {
    type: "promo",
    title: "",
    description: "",
    imageUrl: "",
    ctaLabel: "",
    ctaType: "none",
    ctaTarget: "",
    isActive: true,
    sortOrder: 0,
    startsAt: "",
    endsAt: "",
  };
}

function toInputDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toPayload(form: FormState) {
  return {
    type: form.type,
    title: form.title,
    description: form.description || null,
    imageUrl: form.imageUrl || null,
    ctaLabel: form.ctaType === "none" ? null : form.ctaLabel || null,
    ctaType: form.ctaType,
    ctaTarget: form.ctaType === "none" ? null : form.ctaTarget || null,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
  };
}

function blockToForm(block: MarketingBlock): FormState {
  return {
    type: block.type,
    title: block.title,
    description: block.description ?? "",
    imageUrl: block.imageUrl ?? "",
    ctaLabel: block.ctaLabel ?? "",
    ctaType: block.ctaType,
    ctaTarget: block.ctaTarget ?? "",
    isActive: block.isActive,
    sortOrder: block.sortOrder,
    startsAt: toInputDateTime(block.startsAt),
    endsAt: toInputDateTime(block.endsAt),
  };
}

export default function MenuMarketingBlocksPage() {
  const [blocks, setBlocks] = React.useState<MarketingBlock[]>([]);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [sheetBlock, setSheetBlock] = React.useState<MarketingBlock | "new" | null>(null);
  const [form, setForm] = React.useState<FormState>(createEmptyForm());
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<"all" | MarketingDisplayStatus>("all");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [blocksRes, categoriesRes, productsRes] = await Promise.all([
        fetch("/api/admin/menu/marketing-blocks"),
        fetch("/api/admin/menu/categories"),
        fetch("/api/admin/menu/products?isActive=true"),
      ]);

      const failed = [blocksRes, categoriesRes, productsRes].find((response) => !response.ok);
      if (failed) throw new Error("No se pudieron cargar los bloques comerciales. Intenta nuevamente.");

      const [blocksJson, categoriesJson, productsJson] = await Promise.all([
        blocksRes.json(),
        categoriesRes.json(),
        productsRes.json(),
      ]);

      setBlocks(blocksJson.data || []);
      setCategories(categoriesJson.data || []);
      setProducts(productsJson.data || []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "No se pudieron cargar los bloques comerciales.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData, reloadKey]);

  const productNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) map.set(product.id, product.name);
    return map;
  }, [products]);

  const categoryNameBySlug = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.slug, category.name);
    return map;
  }, [categories]);

  const resolveTargetName = React.useCallback(
    (ctaType: MarketingBlockCtaType, target: string): string | null => {
      if (ctaType === "product") return productNameById.get(target) ?? null;
      if (ctaType === "category") return categoryNameBySlug.get(target) ?? null;
      return null;
    },
    [productNameById, categoryNameBySlug],
  );

  const [nowMs] = React.useState(() => Date.now());
  const statusById = React.useMemo(() => {
    const map = new Map<string, MarketingDisplayStatus>();
    for (const block of blocks) map.set(block.id, getMarketingDisplayStatus(block, nowMs));
    return map;
  }, [blocks, nowMs]);

  const visibleBlocks = blocks.filter(
    (block) => statusFilter === "all" || statusById.get(block.id) === statusFilter,
  );

  const openSheet = (block: MarketingBlock | "new") => {
    setSheetBlock(block);
    setForm(block === "new" ? createEmptyForm() : blockToForm(block));
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetBlock(null);
    setForm(createEmptyForm());
  };

  const handleSave = async () => {
    if (!sheetBlock) return;
    setSaving(true);
    setFeedback(null);
    try {
      const isNew = sheetBlock === "new";
      const response = await fetch(
        isNew ? "/api/admin/menu/marketing-blocks" : `/api/admin/menu/marketing-blocks/${sheetBlock.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toPayload(form)),
        },
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        setFeedback({
          type: "error",
          message: json?.error?.message || "No se pudo guardar el bloque comercial.",
        });
        return;
      }

      setSheetBlock(null);
      setForm(createEmptyForm());
      setFeedback({
        type: "success",
        message: isNew ? "Bloque comercial creado correctamente." : "Bloque comercial actualizado.",
      });
      await fetchData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar. Revisa tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const renderChip = (id: string, label: string, count: number, active: boolean, onSelect: () => void) => (
    <button
      key={id}
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={[
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-st-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none",
        active ? "bg-brand text-ink-inverse" : "bg-surface-low text-ink hover:bg-surface-elevated",
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-st-overline font-bold tabular-nums",
          active ? "bg-white/20 text-inherit" : "bg-surface-card text-ink-secondary",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );

  const statusPillClasses: Record<MarketingDisplayStatus, string> = {
    active: "bg-status-ready-bg text-status-ready-text",
    scheduled: "bg-status-pending-bg text-status-pending-text",
    inactive: "bg-surface-low text-ink-secondary",
  };

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Catálogo"
        title="Hero comercial"
        description="Los banners que ven los clientes arriba de la carta: promociones, eventos y destacados."
        actions={
          <Button type="button" className="min-h-11" onClick={() => openSheet("new")}>
            Nuevo bloque
          </Button>
        }
      />

      {feedback ? (
        <div
          aria-live="polite"
          className={`rounded-stitch-md border px-4 py-3 text-st-body font-medium ${
            feedback.type === "success"
              ? "border-status-ready-border bg-status-ready-bg text-status-ready-text"
              : "border-status-sla-border bg-status-sla-bg text-status-sla-text"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map((filter) =>
          renderChip(
            filter.id,
            filter.label,
            filter.id === "all"
              ? blocks.length
              : blocks.filter((block) => statusById.get(block.id) === filter.id).length,
            statusFilter === filter.id,
            () => setStatusFilter(filter.id),
          ),
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-stitch-lg border border-line-subtle bg-surface-card text-st-body text-ink-secondary">
          Cargando bloques…
        </div>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudieron cargar los bloques comerciales"
          description={loadError}
          action={
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setReloadKey((key) => key + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : visibleBlocks.length === 0 ? (
        <AdminEmptyState
          title={blocks.length === 0 ? "Sin bloques comerciales" : "No hay resultados"}
          description={
            blocks.length === 0
              ? "Crea el primer banner: una promoción, un evento o un destacado de la casa."
              : "Prueba con otro filtro de estado."
          }
          action={
            blocks.length === 0 ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => openSheet("new")}>
                Crear bloque
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section className="overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1" aria-label="Listado de bloques comerciales">
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <p className="text-st-overline font-semibold uppercase tracking-widest text-ink-secondary">
              Bloques en la carta
            </p>
            <p className="font-mono text-st-overline font-bold text-ink-secondary">
              {pluralEs(visibleBlocks.length, "bloque", "bloques")}
            </p>
          </div>

          {visibleBlocks.map((block) => {
            const status = statusById.get(block.id) ?? "inactive";
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => openSheet(block)}
                aria-label={`Editar ${block.title}`}
                className="flex min-h-14 w-full items-start gap-3 border-t border-line-subtle px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary motion-reduce:transition-none"
              >
                <span className="block w-24 shrink-0 overflow-hidden rounded-stitch-md bg-surface-low" style={{ aspectRatio: "16/10" }}>
                  {block.imageUrl ? (
                    <img src={block.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center text-st-overline font-semibold uppercase tracking-wide text-ink-secondary">
                      Sin foto
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-st-body-lg font-semibold leading-snug ${status === "inactive" ? "text-ink-secondary" : "text-ink"}`}>
                    {block.title}
                  </span>
                  <span className="mt-0.5 block text-st-caption leading-5 text-ink-secondary">
                    {describeMarketingCta(block, resolveTargetName)} · {describeMarketingWindow(block, nowMs)}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-st-overline font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${statusPillClasses[status]}`}
                    >
                      {MARKETING_STATUS_LABELS[status]}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-0.5 text-st-overline font-semibold text-brand-primary">
                      {MARKETING_TYPE_LABELS[block.type]}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-0.5 text-st-overline font-semibold text-brand-primary">
                      Orden {block.sortOrder}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      )}

      <AdminEditSheet
        open={sheetBlock !== null}
        onClose={closeSheet}
        kicker={sheetBlock === "new" ? "Hero comercial" : "Editar bloque"}
        title={sheetBlock === "new" ? "Nuevo bloque" : form.title || "Bloque comercial"}
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={saving} onClick={closeSheet}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={saving || !form.title.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : sheetBlock === "new" ? "Crear bloque" : "Guardar cambios"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-st-body font-medium text-ink">
              Tipo
              <select
                className={SELECT_CLASS}
                value={form.type}
                onChange={(e) => setForm((current) => ({ ...current, type: e.target.value as MarketingBlockType }))}
              >
                {(Object.keys(MARKETING_TYPE_LABELS) as MarketingBlockType[]).map((type) => (
                  <option key={type} value={type}>{MARKETING_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <Input
              label="Orden"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((current) => ({ ...current, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>

          <label className="grid gap-1.5 text-st-body font-medium text-ink">
            Descripción
            <textarea
              className="min-h-20 w-full rounded-md border border-line-subtle bg-surface-card px-3 py-2 text-st-body text-ink placeholder:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              placeholder="Texto corto del bloque comercial"
            />
          </label>

          <div>
            <Input
              label="Imagen (URL)"
              value={form.imageUrl}
              onChange={(e) => setForm((current) => ({ ...current, imageUrl: e.target.value }))}
              placeholder="https://..."
            />
            <p className="mt-1 text-st-caption text-ink-secondary">
              Si queda vacío, el bloque se muestra solo con texto.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-st-body font-medium text-ink">
              Botón
              <select
                className={SELECT_CLASS}
                value={form.ctaType}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    ctaType: e.target.value as MarketingBlockCtaType,
                    ctaTarget: "",
                    ctaLabel: e.target.value === "none" ? "" : current.ctaLabel,
                  }))
                }
              >
                <option value="none">Sin botón</option>
                <option value="product">Abrir un plato</option>
                <option value="category">Abrir una categoría</option>
                <option value="url">Abrir un enlace</option>
              </select>
            </label>

            {form.ctaType !== "none" ? (
              <Input
                label="Texto del botón"
                value={form.ctaLabel}
                onChange={(e) => setForm((current) => ({ ...current, ctaLabel: e.target.value }))}
                placeholder="Ej. Ver combo"
              />
            ) : null}
          </div>

          {form.ctaType === "product" ? (
            <label className="grid gap-1.5 text-st-body font-medium text-ink">
              Plato destino
              <select
                className={SELECT_CLASS}
                value={form.ctaTarget}
                onChange={(e) => setForm((current) => ({ ...current, ctaTarget: e.target.value }))}
              >
                <option value="">Selecciona un plato</option>
                {products.filter((product) => product.availability.isActive).map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {form.ctaType === "category" ? (
            <label className="grid gap-1.5 text-st-body font-medium text-ink">
              Categoría destino
              <select
                className={SELECT_CLASS}
                value={form.ctaTarget}
                onChange={(e) => setForm((current) => ({ ...current, ctaTarget: e.target.value }))}
              >
                <option value="">Selecciona una categoría</option>
                {categories.filter((category) => category.isActive).map((category) => (
                  <option key={category.id} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {form.ctaType === "url" ? (
            <Input
              label="URL destino"
              placeholder="https://... o /ruta"
              value={form.ctaTarget}
              onChange={(e) => setForm((current) => ({ ...current, ctaTarget: e.target.value }))}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Visible desde"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))}
              />
              <p className="mt-1 text-st-caption text-ink-secondary">Opcional — vacío es “desde ya”.</p>
            </div>
            <div>
              <Input
                label="Visible hasta"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))}
              />
              <p className="mt-1 text-st-caption text-ink-secondary">Opcional — vacío es “sin fin”.</p>
            </div>
          </div>

          <label className="grid gap-1.5 text-st-body font-medium text-ink">
            Estado
            <select
              className={SELECT_CLASS}
              value={form.isActive ? "active" : "inactive"}
              onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.value === "active" }))}
            >
              <option value="active">Activo — visible según sus fechas</option>
              <option value="inactive">Inactivo — no se muestra en la carta</option>
            </select>
          </label>
        </div>
      </AdminEditSheet>
    </div>
  );
}
