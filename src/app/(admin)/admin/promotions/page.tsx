"use client";

import * as React from "react";

import { BOGO_SCOPE_TYPES, type BogoScopeType } from "@/modules/orders/domain/promo-bogo";
import { validatePromotionInput } from "@/modules/orders/domain/promotion-rules";
import type {
  AdminPromotion,
  PromotionStatus,
} from "@/modules/orders/features/list-promotions/list-promotions";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import AdminEditSheet from "../_components/admin-edit-sheet";
import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import { pluralEs } from "../menu/categories/category-list-helpers";
import {
  PROMOTION_STATUS_LABELS,
  PROMOTION_TYPE_LABELS,
  SCOPE_TYPE_LABELS,
  createEmptyPromotionForm,
  describePromotionExpiry,
  describePromotionRule,
  describePromotionScope,
  describePromotionUsage,
  promotionFormToInput,
  promotionToForm,
  type PromotionFormState,
} from "./promotion-helpers";

/**
 * T9c — promos del admin.
 *
 * Es la pantalla que faltaba para que el owner no dependa de la base: crea el código,
 * elige qué descuenta y a qué alcanza, y lo apaga cuando quiere. El checkout y la
 * confirmación ya sabían aplicar la promo; acá se administra.
 */
type ScopeOption = { id: string; label: string };

type CategoryOption = { id: string; name: string; isActive: boolean };
type SubcategoryOption = { id: string; name: string; isActive: boolean };
type ProductOption = { id: string; name: string; availability: { isActive: boolean } };

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const STATUS_FILTERS: { id: "all" | PromotionStatus; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Activas" },
  { id: "inactive", label: "Inactivas" },
  { id: "expired", label: "Vencidas" },
  { id: "exhausted", label: "Agotadas" },
];

const STATUS_PILL_CLASSES: Record<PromotionStatus, string> = {
  active: "bg-success text-success-foreground",
  inactive: "bg-secondary text-muted-foreground",
  expired: "bg-warning text-warning-foreground",
  exhausted: "bg-warning text-warning-foreground",
};

export default function AdminPromotionsPage() {
  const currency = useCurrencyFormat();
  const timeZone = useBusinessSettings().timezone;

  const [promotions, setPromotions] = React.useState<AdminPromotion[]>([]);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [subcategories, setSubcategories] = React.useState<SubcategoryOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [sheetPromo, setSheetPromo] = React.useState<AdminPromotion | "new" | null>(null);
  const [form, setForm] = React.useState<PromotionFormState>(createEmptyPromotionForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = React.useState<"all" | PromotionStatus>("all");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [promosRes, categoriesRes, subcategoriesRes, productsRes] = await Promise.all([
        fetch("/api/admin/promotions"),
        fetch("/api/admin/menu/categories"),
        fetch("/api/admin/menu/subcategories"),
        fetch("/api/admin/menu/products?isActive=true"),
      ]);

      const failed = [promosRes, categoriesRes, subcategoriesRes, productsRes].find(
        (response) => !response.ok,
      );
      if (failed) throw new Error("No se pudieron cargar las promos. Intenta nuevamente.");

      const [promosJson, categoriesJson, subcategoriesJson, productsJson] = await Promise.all([
        promosRes.json(),
        categoriesRes.json(),
        subcategoriesRes.json(),
        productsRes.json(),
      ]);

      setPromotions(promosJson.data || []);
      setCategories(categoriesJson.data || []);
      setSubcategories(subcategoriesJson.data || []);
      setProducts(productsJson.data || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las promos.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData, reloadKey]);

  const scopeNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    for (const subcategory of subcategories) map.set(subcategory.id, subcategory.name);
    for (const product of products) map.set(product.id, product.name);
    return map;
  }, [categories, subcategories, products]);

  const scopeOptions = React.useMemo<Record<Exclude<BogoScopeType, "all">, ScopeOption[]>>(
    () => ({
      category: categories
        .filter((category) => category.isActive)
        .map((category) => ({ id: category.id, label: category.name })),
      subcategory: subcategories
        .filter((subcategory) => subcategory.isActive)
        .map((subcategory) => ({ id: subcategory.id, label: subcategory.name })),
      product: products
        .filter((product) => product.availability.isActive)
        .map((product) => ({ id: product.id, label: product.name })),
    }),
    [categories, subcategories, products],
  );

  const visiblePromotions = promotions.filter(
    (promotion) => statusFilter === "all" || promotion.status === statusFilter,
  );

  const openSheet = (promotion: AdminPromotion | "new") => {
    setSheetPromo(promotion);
    setFieldErrors({});
    setFeedback(null);
    setForm(
      promotion === "new" ? createEmptyPromotionForm() : promotionToForm(promotion, timeZone),
    );
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetPromo(null);
    setForm(createEmptyPromotionForm());
    setFieldErrors({});
  };

  const handleSave = async () => {
    if (!sheetPromo) return;

    const input = promotionFormToInput(form);
    const errors = validatePromotionInput(input);
    if (Object.keys(errors).length > 0) {
      // Las mismas reglas que aplica el servidor: mejor avisar antes de gastar el viaje.
      setFieldErrors(errors);
      return;
    }

    const isNew = sheetPromo === "new";
    setSaving(true);
    setFeedback(null);
    setFieldErrors({});

    try {
      const response = await fetch(
        isNew ? "/api/admin/promotions" : `/api/admin/promotions/${sheetPromo.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        const fields = json?.error?.fields ?? {};
        setFieldErrors(fields);
        setFeedback({
          type: "error",
          message:
            Object.keys(fields).length > 0
              ? "Revisá los campos marcados."
              : "No se pudo guardar la promo. Intentá de nuevo.",
        });
        return;
      }

      setSheetPromo(null);
      setForm(createEmptyPromotionForm());
      setFeedback({
        type: "success",
        message: isNew ? "Promo creada." : "Promo actualizada.",
      });
      await fetchData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sheetPromo || sheetPromo === "new") return;

    const confirmed = window.confirm(
      `¿Borrar la promo ${sheetPromo.code}? El código deja de funcionar en el checkout.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/promotions/${sheetPromo.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setFeedback({ type: "error", message: "No se pudo borrar la promo. Intentá de nuevo." });
        return;
      }

      setPromotions((current) => current.filter((promo) => promo.id !== sheetPromo.id));
      setSheetPromo(null);
      setFeedback({ type: "success", message: "Promo borrada." });
    } catch {
      setFeedback({ type: "error", message: "No se pudo borrar. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const scopeChoices =
    form.scopeType === "all" ? [] : scopeOptions[form.scopeType as Exclude<BogoScopeType, "all">];

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Catálogo"
        title="Promos"
        description="Códigos que el cliente escribe en el checkout: porcentaje, monto fijo o 2×1 por cantidad."
        actions={
          <Button type="button" className="min-h-11" onClick={() => openSheet("new")}>
            Nueva promo
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

      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map((filter) => {
          const count =
            filter.id === "all"
              ? promotions.length
              : promotions.filter((promo) => promo.status === filter.id).length;
          const active = statusFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(filter.id)}
              className={[
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none",
                active
                  ? "bg-brand text-brand-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              ].join(" ")}
            >
              <span>{filter.label}</span>
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
        })}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          Cargando promos…
        </div>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudieron cargar las promos"
          description={loadError}
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Reintentar
            </Button>
          }
        />
      ) : visiblePromotions.length === 0 ? (
        <AdminEmptyState
          title={promotions.length === 0 ? "Sin promos" : "No hay resultados"}
          description={
            promotions.length === 0
              ? "Creá la primera promo: el cliente la aplica con el código en el checkout."
              : "Probá con otro filtro de estado."
          }
          action={
            promotions.length === 0 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => openSheet("new")}
              >
                Crear promo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          aria-label="Listado de promos"
        >
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Promos del negocio
            </p>
            <p className="font-mono text-[11px] font-bold text-muted-foreground">
              {pluralEs(visiblePromotions.length, "promo", "promos")}
            </p>
          </div>

          {visiblePromotions.map((promotion) => (
            <button
              key={promotion.id}
              type="button"
              onClick={() => openSheet(promotion)}
              aria-label={`Editar promo ${promotion.code}`}
              className="flex min-h-14 w-full flex-col gap-1 border-t border-border px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand motion-reduce:transition-none"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`font-mono text-sm font-bold tracking-wide ${
                    promotion.status === "active" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {promotion.code}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${STATUS_PILL_CLASSES[promotion.status]}`}
                >
                  {PROMOTION_STATUS_LABELS[promotion.status]}
                </span>
                <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-strong">
                  {PROMOTION_TYPE_LABELS[promotion.type]}
                </span>
              </span>
              <span className="block text-sm font-medium text-foreground">
                {describePromotionRule(promotion, currency)}
                {promotion.type === "bogo"
                  ? ` · ${describePromotionScope(promotion, (id) => scopeNameById.get(id) ?? null)}`
                  : ""}
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">
                {describePromotionUsage(promotion)} · {describePromotionExpiry(promotion, timeZone)}
              </span>
            </button>
          ))}
        </section>
      )}

      <AdminEditSheet
        open={sheetPromo !== null}
        onClose={closeSheet}
        kicker={sheetPromo === "new" ? "Promos" : "Editar promo"}
        title={sheetPromo === "new" ? "Nueva promo" : form.code || "Promo"}
        footer={
          <div className="flex gap-2">
            {sheetPromo && sheetPromo !== "new" ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={saving}
                aria-label={`Eliminar promo ${sheetPromo.code}`}
                onClick={() => void handleDelete()}
              >
                Eliminar
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              disabled={saving}
              onClick={closeSheet}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : sheetPromo === "new" ? "Crear promo" : "Guardar cambios"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <Input
            label="Código"
            value={form.code}
            error={fieldErrors.code}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            placeholder="Ej. B2G1"
            autoCapitalize="characters"
            required
          />
          <p className="-mt-2 text-xs text-muted-foreground">
            Es el código que escribe el cliente en el checkout. Se guarda en mayúsculas.
          </p>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Tipo
            <select
              className={SELECT_CLASS}
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as PromotionFormState["type"],
                }))
              }
            >
              {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionFormState["type"][]).map((type) => (
                <option key={type} value={type}>
                  {PROMOTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          {form.type === "percentage" ? (
            <Input
              label="Porcentaje (%)"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={form.value}
              error={fieldErrors.value}
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
            />
          ) : null}

          {form.type === "fixed_amount" ? (
            <Input
              label="Monto de descuento"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.value}
              error={fieldErrors.value}
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
            />
          ) : null}

          {form.type === "bogo" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Unidades que se llevan"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.buyQuantity}
                  error={fieldErrors.buyQuantity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, buyQuantity: event.target.value }))
                  }
                />
                <Input
                  label="Unidades gratis"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.freeQuantity}
                  error={fieldErrors.freeQuantity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, freeQuantity: event.target.value }))
                  }
                />
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Se aplica por bloque: con 2 y 1, el cliente lleva 3 y paga 2.
              </p>

              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Alcance
                <select
                  className={SELECT_CLASS}
                  value={form.scopeType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scopeType: event.target.value as BogoScopeType,
                      scopeId: "",
                    }))
                  }
                >
                  {BOGO_SCOPE_TYPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {SCOPE_TYPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </label>

              {form.scopeType !== "all" ? (
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  ¿A qué alcanza?
                  <select
                    className={SELECT_CLASS}
                    value={form.scopeId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, scopeId: event.target.value }))
                    }
                  >
                    <option value="">Elegí una opción</option>
                    {scopeChoices.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.scopeId ? (
                    <span className="text-xs font-medium text-danger-strong">
                      {fieldErrors.scopeId}
                    </span>
                  ) : null}
                </label>
              ) : null}
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Límite de usos"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.usageLimit}
              error={fieldErrors.usageLimit}
              onChange={(event) =>
                setForm((current) => ({ ...current, usageLimit: event.target.value }))
              }
            />
            <div>
              <Input
                label="Vence el"
                type="date"
                value={form.expiresAt}
                error={fieldErrors.expiresAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, expiresAt: event.target.value }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">Vacío = no vence.</p>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Límite de usos: 0 es sin límite. La promo sirve hasta el final del día que vence.
          </p>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Estado
            <select
              className={SELECT_CLASS}
              value={form.isActive ? "active" : "inactive"}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.value === "active" }))
              }
            >
              <option value="active">Activa — la promo se aplica</option>
              <option value="inactive">Inactiva — no se aplica</option>
            </select>
          </label>
        </div>
      </AdminEditSheet>
    </div>
  );
}
