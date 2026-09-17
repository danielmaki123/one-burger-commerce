"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import type { LocationCatalogItem } from "@/modules/locations/features/list-location-catalog/list-location-catalog";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import AdminEditSheet from "../../_components/admin-edit-sheet";
import { AdminEmptyState } from "../../_components/admin-operational-ui";
import {
  CATALOG_STATUS_LABELS,
  catalogFormToInput,
  catalogItemToForm,
  createEmptyCatalogForm,
  describeCatalogSummary,
  describeLocationProductRow,
  locationCatalogStatus,
  type CatalogFormState,
} from "./catalog-helpers";

/**
 * T8 fase 4b — catálogo y precios de un local.
 *
 * El local no tiene una copia del menú: tiene **excepciones** (precio propio, agotado, no se
 * vende acá). Por eso la pantalla lista todo el menú del negocio y muestra al lado el precio
 * que cobraría este local, que es el que resuelve el servidor.
 */
const SELECT_CLASS =
  "h-11 w-full rounded-md border border-line-subtle bg-surface-card px-3 text-st-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary";

type CatalogMeta = {
  location: { id: string; name: string };
  total: number;
  sold: number;
  unavailable: number;
  overridden: number;
};

export default function LocationCatalogPage() {
  const params = useParams<{ id: string }>();
  const locationId = params?.id ?? "";
  const currency = useCurrencyFormat();

  const [items, setItems] = React.useState<LocationCatalogItem[]>([]);
  const [meta, setMeta] = React.useState<CatalogMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [sheetItem, setSheetItem] = React.useState<LocationCatalogItem | null>(null);
  const [form, setForm] = React.useState<CatalogFormState>(createEmptyCatalogForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const fetchCatalog = React.useCallback(async () => {
    if (!locationId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/admin/locations/${locationId}/products`);
      if (!response.ok) throw new Error("No se pudo cargar el catálogo. Intentá nuevamente.");

      const json = await response.json();
      setItems(json.data || []);
      setMeta(json.meta ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  React.useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog, reloadKey]);

  const openSheet = (item: LocationCatalogItem) => {
    setSheetItem(item);
    setFieldErrors({});
    setFeedback(null);
    setForm(catalogItemToForm(item));
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetItem(null);
    setForm(createEmptyCatalogForm());
    setFieldErrors({});
  };

  const save = async (input: ReturnType<typeof catalogFormToInput>) => {
    if (!sheetItem) return;

    setSaving(true);
    setFeedback(null);
    setFieldErrors({});

    try {
      const response = await fetch(
        `/api/admin/locations/${locationId}/products/${sheetItem.productId}`,
        {
          method: "PUT",
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
              : "No se pudo guardar el producto. Intentá de nuevo.",
        });
        return;
      }

      setSheetItem(null);
      setForm(createEmptyCatalogForm());
      setFeedback({ type: "success", message: "Producto actualizado." });
      await fetchCatalog();
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const statusPillClasses: Record<ReturnType<typeof locationCatalogStatus>, string> = {
    sold: "bg-status-ready-bg text-status-ready-text",
    unavailable: "bg-status-pending-bg text-status-pending-text",
    "not-sold": "bg-surface-low text-ink-secondary",
  };

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-st-caption font-semibold uppercase tracking-wider text-brand">Catálogo</p>
            <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-ink">
              {meta?.location.name ?? "Local"}
            </h1>
            <p className="mt-1 max-w-2xl text-st-body leading-6 text-ink-secondary">
              {meta ? describeCatalogSummary(meta) : "Precios y disponibilidad de este local."}
            </p>
          </div>
          <Link
            href="/admin/locations"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line-subtle bg-surface-card px-4 text-st-body font-medium text-ink hover:bg-surface-elevated"
          >
            Volver a locales
          </Link>
        </div>
      </section>

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

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-stitch-lg border border-line-subtle bg-surface-card text-st-body text-ink-secondary">
          Cargando catálogo…
        </div>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudo cargar el catálogo"
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
      ) : items.length === 0 ? (
        <AdminEmptyState
          title="Sin productos en el menú"
          description="Cargá productos en Menú y después volvé para ajustar precios y disponibilidad por local."
        />
      ) : (
        <section
          className="overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1"
          aria-label="Catálogo del local"
        >
          {items.map((item) => {
            const status = locationCatalogStatus(item);

            return (
              <button
                key={item.productId}
                type="button"
                onClick={() => openSheet(item)}
                aria-label={`Editar ${item.name}`}
                className="flex min-h-14 w-full flex-col gap-1 border-t border-line-subtle px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary motion-reduce:transition-none"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-st-body-lg font-semibold ${
                      status === "not-sold" ? "text-ink-secondary" : "text-ink"
                    }`}
                  >
                    {item.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-st-overline font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${statusPillClasses[status]}`}
                  >
                    {CATALOG_STATUS_LABELS[status]}
                  </span>
                </span>
                <span className="block text-st-body text-ink">
                  {describeLocationProductRow(item, currency)}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <AdminEditSheet
        open={sheetItem !== null}
        onClose={closeSheet}
        kicker={meta?.location.name ?? "Catálogo"}
        title={sheetItem?.name ?? "Producto"}
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              // Solo saca el precio propio: la disponibilidad y "se vende acá" quedan como
              // están en el formulario (apagar un precio no puede desmarcar un agotado).
              onClick={() => void save({ ...catalogFormToInput(form), priceOverride: null })}
            >
              Volver al precio base
            </Button>
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
              onClick={() => void save(catalogFormToInput(form))}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div>
            <Input
              label="Precio en este local"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.priceOverride}
              error={fieldErrors.priceOverride}
              onChange={(event) =>
                setForm((current) => ({ ...current, priceOverride: event.target.value }))
              }
              placeholder={sheetItem ? String(sheetItem.basePrice) : ""}
            />
            <p className="mt-1 text-st-caption text-ink-secondary">
              Vacío = el precio del negocio
              {sheetItem ? ` (${describeLocationProductRow({ ...sheetItem, price: sheetItem.basePrice, hasPriceOverride: false }, currency)})` : ""}
              . Si después cambia el precio del menú, este local lo sigue.
            </p>
          </div>

          <label className="grid gap-1.5 text-st-body font-medium text-ink">
            En este local
            <select
              className={SELECT_CLASS}
              value={form.isActive ? "yes" : "no"}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.value === "yes" }))
              }
            >
              <option value="yes">Se vende en este local</option>
              <option value="no">No se vende en este local</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-st-body font-medium text-ink">
            Disponibilidad
            <select
              className={SELECT_CLASS}
              value={form.isAvailable ? "yes" : "no"}
              onChange={(event) =>
                setForm((current) => ({ ...current, isAvailable: event.target.value === "yes" }))
              }
            >
              <option value="yes">Disponible</option>
              <option value="no">Agotado acá</option>
            </select>
          </label>
        </div>
      </AdminEditSheet>
    </div>
  );
}
