"use client";

import * as React from "react";

import { cloneBusinessHours } from "@/modules/business-settings/domain/business-settings-defaults";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import { validateLocationInput } from "@/modules/locations/domain/location-rules";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";

import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import { pluralEs } from "../menu/categories/category-list-helpers";
import { LocationFormSheet } from "./location-form-sheet";
import { LocationRow } from "./location-row";
import { buildApplyHoursRequests } from "./apply-hours-helpers";
import {
  createEmptyLocationForm,
  locationFormToInput,
  locationToForm,
  type LocationFormState,
} from "./location-helpers";

/**
 * T8 fase 3 — locales del admin.
 *
 * Es la pantalla que faltaba para que el owner no dependa de la API: crear un local, cargar
 * dónde se retira, su horario y si está recibiendo pedidos. El menú y los precios por local
 * llegan en la fase 4; acá está todo lo que hace a la operación del local.
 *
 * TASK-308 sumó el interruptor del **punto de venta** por local y cambió los dos selects crudos del
 * formulario por el `Select` de TASK-206 (mismo control, con etiqueta asociada y error anunciado).
 */

export default function AdminLocationsPage() {
  const settings = useBusinessSettings();

  const [locations, setLocations] = React.useState<LocationRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [sheetLocation, setSheetLocation] = React.useState<LocationRecord | "new" | null>(null);
  const [form, setForm] = React.useState<LocationFormState>(createEmptyLocationForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  // El "hoy" del resumen de horario se resuelve después de montar: en el servidor y en el
  // cliente podrían caer en días distintos y el HTML no coincidiría al hidratar.
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const fetchLocations = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/admin/locations");
      if (!response.ok) throw new Error("No se pudieron cargar los locales. Intentá nuevamente.");

      const json = await response.json();
      setLocations(json.data || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los locales.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchLocations();
  }, [fetchLocations, reloadKey]);

  const openSheet = (location: LocationRecord | "new") => {
    setSheetLocation(location);
    setFieldErrors({});
    setFeedback(null);

    if (location === "new") {
      // Un local nuevo arranca con el horario que el negocio ya tiene configurado.
      setForm({
        ...createEmptyLocationForm(),
        businessHours: cloneBusinessHours(settings.businessHours),
        pickupLeadMinutes: String(settings.pickupLeadMinutes),
        pickupMaxMinutes:
          settings.pickupMaxMinutes === null ? "" : String(settings.pickupMaxMinutes),
      });
      return;
    }

    setForm(locationToForm(location));
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetLocation(null);
    setForm(createEmptyLocationForm());
    setFieldErrors({});
  };

  /**
   * A — activar o apagar la sucursal de un toque, sin abrir el formulario.
   *
   * El PATCH es de guardado completo, así que se manda el local tal como está con `isActive`
   * invertido: el toque no pierde nada de lo demás. Si la API lo rechaza (el último local activo),
   * se muestra su motivo y el estado no cambia en pantalla.
   */
  const handleToggleActive = async (location: LocationRecord) => {
    if (saving) return;

    setSaving(true);
    setFeedback(null);

    const nextIsActive = !location.isActive;
    const input = locationFormToInput({ ...locationToForm(location), isActive: nextIsActive });

    try {
      const response = await fetch(`/api/admin/locations/${location.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        const fields = json?.error?.fields ?? {};

        setFeedback({
          type: "error",
          message:
            fields.isActive ??
            json?.error?.message ??
            "No se pudo cambiar el estado del local.",
        });
        return;
      }

      setLocations((current) =>
        current.map((entry) =>
          entry.id === location.id ? { ...entry, isActive: nextIsActive } : entry,
        ),
      );
      setFeedback({
        type: "success",
        message: nextIsActive ? "Local activado." : "Local apagado.",
      });
    } catch {
      setFeedback({ type: "error", message: "No se pudo cambiar el estado. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!sheetLocation) return;

    const input = locationFormToInput(form);
    const errors = validateLocationInput(input);
    if (Object.keys(errors).length > 0) {
      // Las mismas reglas que aplica el servidor: mejor avisar antes de gastar el viaje.
      setFieldErrors(errors);
      return;
    }

    const isNew = sheetLocation === "new";
    setSaving(true);
    setFeedback(null);
    setFieldErrors({});

    try {
      const response = await fetch(
        isNew ? "/api/admin/locations" : `/api/admin/locations/${sheetLocation.id}`,
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
              : "No se pudo guardar el local. Intentá de nuevo.",
        });
        return;
      }

      setSheetLocation(null);
      setForm(createEmptyLocationForm());
      setFeedback({ type: "success", message: isNew ? "Local creado." : "Local actualizado." });
      await fetchLocations();
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sheetLocation || sheetLocation === "new") return;

    const confirmed = window.confirm(
      `¿Borrar el local ${sheetLocation.name}? Los pedidos nuevos no van a poder elegirlo.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/locations/${sheetLocation.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        const fields = json?.error?.fields ?? {};
        setFieldErrors(fields);
        setFeedback({
          type: "error",
          message: fields.id ?? "No se pudo borrar el local. Intentá de nuevo.",
        });
        return;
      }

      setLocations((current) => current.filter((location) => location.id !== sheetLocation.id));
      setSheetLocation(null);
      setFeedback({ type: "success", message: "Local borrado." });
    } catch {
      setFeedback({ type: "error", message: "No se pudo borrar. Revisá tu conexión." });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyHoursToAll = async () => {
    if (!sheetLocation || sheetLocation === "new") return;

    setSaving(true);
    setFeedback(null);

    try {
      const requests = buildApplyHoursRequests(locations, sheetLocation.id, form.businessHours);

      for (const request of requests) {
        const response = await fetch(`/api/admin/locations/${request.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request.payload),
        });

        if (!response.ok) {
          setFeedback({
            type: "error",
            message: `No se pudo aplicar el horario en ${request.name}. Revisá los datos de esa sucursal.`,
          });
          return;
        }
      }

      setFeedback({
        type: "success",
        message:
          requests.length === 1
            ? "Horario aplicado a la otra sucursal."
            : `Horario aplicado a ${requests.length} sucursales.`,
      });
      setReloadKey((key) => key + 1);
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo aplicar el horario. Revisá la conexión.",
      });
    } finally {
      setSaving(false);
    }
  };

  const activeCount = locations.filter((location) => location.isActive).length;
  const acceptingCount = locations.filter(
    (location) => location.isActive && location.isAcceptingOrders,
  ).length;

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Configuración · Sedes operativas"
        title="Locales"
        description="Dónde se retira, en qué horario y si el local está recibiendo pedidos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 items-center gap-2 rounded-stitch-md border border-line-subtle bg-surface-low px-3 text-st-body font-semibold text-ink-secondary">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  activeCount > 0 ? "bg-status-ready-dot" : "bg-status-inactive-dot"
                }`}
              />
              {pluralEs(activeCount, "sede en línea", "sedes en línea")}
            </span>
            <Button type="button" className="min-h-11" onClick={() => openSheet("new")}>
              Nuevo local
            </Button>
          </div>
        }
      />


      {activeCount > 0 && acceptingCount === 0 ? (
        <p className="rounded-stitch-lg border border-status-prep-border bg-status-prep-bg px-4 py-3 text-st-body font-medium text-status-prep-text">
          Ninguna sede está recibiendo pedidos: revisá «Aceptando pedidos» en cada local.
        </p>
      ) : null}

      {feedback ? (
        <div
          aria-live="polite"
          className={`rounded-stitch-lg border px-4 py-3 text-st-body font-medium ${
            feedback.type === "success"
              ? "border-status-ready-border bg-status-ready-bg text-status-ready-text"
              : "border-status-sla-border bg-status-sla-bg text-status-sla-text"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {loading ? (
        <div
          role="status"
          className="flex h-40 items-center justify-center rounded-stitch-lg border border-line-subtle bg-surface-card text-st-body text-ink-secondary"
        >
          Cargando locales…
        </div>
      ) : loadError ? (
        <AdminEmptyState
          title="No se pudieron cargar los locales"
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
      ) : locations.length === 0 ? (
        <AdminEmptyState
          title="Sin locales"
          description="Creá el primero: sin local no se pueden recibir pedidos."
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => openSheet("new")}
            >
              Crear local
            </Button>
          }
        />
      ) : (
        <section
          className="overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1"
          aria-label="Listado de locales"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-subtle px-3 pb-2 pt-3 md:px-4">
            <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Locales del negocio
            </p>
            <p className="font-mono text-st-caption font-bold tabular-nums text-ink-secondary">
              {pluralEs(locations.length, "local", "locales")} · {activeCount} activos
            </p>
          </div>

          {locations.map((location) => (
            <LocationRow
              key={location.id}
              location={location}
              now={now}
              timeZone={settings.timezone}
              saving={saving}
              onEdit={() => openSheet(location)}
              onToggleActive={() => void handleToggleActive(location)}
            />
          ))}

          <p className="border-t border-line-subtle bg-surface-low px-3 py-2 text-st-caption text-ink-secondary md:px-4">
            Apagar un local suspende la recepción de pedidos para retiro en la web y en el POS.
          </p>
        </section>
      )}

      <LocationFormSheet
        open={sheetLocation !== null}
        isNew={sheetLocation === "new"}
        locationName={sheetLocation && sheetLocation !== "new" ? sheetLocation.name : ""}
        title={sheetLocation === "new" ? "Nuevo local" : form.name || "Local"}
        form={form}
        fieldErrors={fieldErrors}
        saving={saving}
        canApplyHoursToAll={sheetLocation !== null && sheetLocation !== "new" && locations.length > 1}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onClose={closeSheet}
        onSave={() => void handleSave()}
        onDelete={() => void handleDelete()}
        onApplyHoursToAll={() => void handleApplyHoursToAll()}
      />
    </div>
  );
}
