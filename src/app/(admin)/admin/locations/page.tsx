"use client";

import * as React from "react";

import { cloneBusinessHours } from "@/modules/business-settings/domain/business-settings-defaults";
import { WEEKDAY_KEYS } from "@/modules/business-settings/domain/business-settings.types";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import { validateLocationInput } from "@/modules/locations/domain/location-rules";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import AdminEditSheet from "../_components/admin-edit-sheet";
import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";
import { pluralEs } from "../menu/categories/category-list-helpers";
import {
  LOCATION_STATUS_LABELS,
  WEEKDAY_LABELS,
  createEmptyLocationForm,
  describeLocationAddress,
  describeLocationHours,
  locationFormToInput,
  locationStatus,
  locationToForm,
  type LocationFormState,
} from "./location-helpers";

/**
 * T8 fase 3 — locales del admin.
 *
 * Es la pantalla que faltaba para que el owner no dependa de la API: crear un local, cargar
 * dónde se retira, su horario y si está recibiendo pedidos. El menú y los precios por local
 * llegan en la fase 4; acá está todo lo que hace a la operación del local.
 */
const SELECT_CLASS =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

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

  const setHours = (weekday: (typeof WEEKDAY_KEYS)[number], patch: Partial<LocationFormState["businessHours"][typeof weekday]>) => {
    setForm((current) => ({
      ...current,
      businessHours: {
        ...current.businessHours,
        [weekday]: { ...current.businessHours[weekday], ...patch },
      },
    }));
  };

  const activeCount = locations.filter((location) => location.isActive).length;

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        label="Configuración"
        title="Locales"
        description="Dónde se retira, en qué horario y si el local está recibiendo pedidos."
        actions={
          <Button type="button" className="min-h-11" onClick={() => openSheet("new")}>
            Nuevo local
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

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
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
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          aria-label="Listado de locales"
        >
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Locales del negocio
            </p>
            <p className="font-mono text-[11px] font-bold text-muted-foreground">
              {pluralEs(locations.length, "local", "locales")} · {activeCount} activos
            </p>
          </div>

          {locations.map((location) => {
            const status = locationStatus(location);

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => openSheet(location)}
                aria-label={`Editar local ${location.name}`}
                className="flex min-h-14 w-full flex-col gap-1 border-t border-border px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand motion-reduce:transition-none"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[15px] font-semibold ${
                      location.isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {location.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${
                      location.isActive
                        ? "bg-success text-success-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {LOCATION_STATUS_LABELS[status]}
                  </span>
                  {location.isAcceptingOrders ? null : (
                    <span className="inline-flex items-center rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
                      No recibe pedidos
                    </span>
                  )}
                </span>
                <span className="block text-sm text-foreground">
                  {describeLocationAddress(location)}
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {now
                    ? `${describeLocationHours(location, settings.timezone, now)} · preparación ${location.pickupLeadMinutes} min`
                    : `Preparación ${location.pickupLeadMinutes} min`}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <AdminEditSheet
        open={sheetLocation !== null}
        onClose={closeSheet}
        kicker={sheetLocation === "new" ? "Locales" : "Editar local"}
        title={sheetLocation === "new" ? "Nuevo local" : form.name || "Local"}
        footer={
          <div className="flex gap-2">
            {sheetLocation && sheetLocation !== "new" ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={saving}
                aria-label={`Eliminar local ${sheetLocation.name}`}
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
            <Button type="button" className="min-h-11 flex-1" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Guardando…" : sheetLocation === "new" ? "Crear local" : "Guardar cambios"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <Input
            label="Nombre"
            value={form.name}
            error={fieldErrors.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ej. Sucursal Norte"
          />

          <div>
            <Input
              label="Identificador para la URL"
              value={form.slug}
              error={fieldErrors.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="sucursal-norte"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Se guarda en minúsculas y con guiones. Es el nombre corto del local.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dirección"
              value={form.addressLine}
              error={fieldErrors.addressLine}
              onChange={(event) =>
                setForm((current) => ({ ...current, addressLine: event.target.value }))
              }
            />
            <Input
              label="Ciudad"
              value={form.city}
              error={fieldErrors.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Referencia"
              value={form.addressReference}
              onChange={(event) =>
                setForm((current) => ({ ...current, addressReference: event.target.value }))
              }
              placeholder="Ej. frente al parque"
            />
            <Input
              label="Enlace al mapa"
              value={form.mapsUrl}
              onChange={(event) => setForm((current) => ({ ...current, mapsUrl: event.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <Input
              label="WhatsApp del local"
              value={form.whatsapp}
              error={fieldErrors.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))}
              placeholder="50588887777"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitud"
              value={form.latitude}
              error={fieldErrors.latitude}
              onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
              placeholder="11.85"
            />
            <Input
              label="Longitud"
              value={form.longitude}
              error={fieldErrors.longitude}
              onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
              placeholder="-86.20"
            />
          </div>

          <fieldset className="grid gap-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-medium text-foreground">Horario del local</legend>
            {fieldErrors.businessHours ? (
              <p role="alert" className="text-xs font-medium text-danger-strong">
                {fieldErrors.businessHours}
              </p>
            ) : null}
            {WEEKDAY_KEYS.map((weekday) => (
              <div key={weekday} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                <span className="pb-2 text-sm text-foreground">{WEEKDAY_LABELS[weekday]}</span>
                <Input
                  label={`${WEEKDAY_LABELS[weekday]} abre`}
                  type="time"
                  value={form.businessHours[weekday].open}
                  disabled={form.businessHours[weekday].closed}
                  onChange={(event) => setHours(weekday, { open: event.target.value })}
                />
                <Input
                  label={`${WEEKDAY_LABELS[weekday]} cierra`}
                  type="time"
                  value={form.businessHours[weekday].close}
                  disabled={form.businessHours[weekday].closed}
                  onChange={(event) => setHours(weekday, { close: event.target.value })}
                />
                <div className="min-h-11 flex items-center">
                  <Checkbox
                    id={`location-hours-${weekday}-closed`}
                    checked={form.businessHours[weekday].closed}
                    onChange={(event) => setHours(weekday, { closed: event.target.checked })}
                    label={`Cerrado ${WEEKDAY_LABELS[weekday]}`}
                  />
                </div>
              </div>
            ))}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Minutos de preparación"
              type="number"
              inputMode="numeric"
              min={0}
              max={180}
              value={form.pickupLeadMinutes}
              error={fieldErrors.pickupLeadMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, pickupLeadMinutes: event.target.value }))
              }
            />
            <div>
              <Input
                label="Rango máximo (opcional)"
                type="number"
                inputMode="numeric"
                min={0}
                max={240}
                value={form.pickupMaxMinutes}
                error={fieldErrors.pickupMaxMinutes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pickupMaxMinutes: event.target.value }))
                }
                placeholder="Sin rango"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Vacío = el cliente ve una sola hora.
              </p>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Los minutos de preparación definen el primer turno de retiro y hasta qué hora entra un
            pedido en este local.
          </p>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Aceptando pedidos
            <select
              className={SELECT_CLASS}
              value={form.isAcceptingOrders ? "yes" : "no"}
              onChange={(event) =>
                setForm((current) => ({ ...current, isAcceptingOrders: event.target.value === "yes" }))
              }
            >
              <option value="yes">Sí, está recibiendo pedidos</option>
              <option value="no">No, pausado</option>
            </select>
          </label>

          <Input
            label="Mensaje cuando no acepta"
            value={form.closedMessage}
            error={fieldErrors.closedMessage}
            onChange={(event) =>
              setForm((current) => ({ ...current, closedMessage: event.target.value }))
            }
            placeholder="Ej. Estamos cerrados. Volvé cuando abramos."
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Orden en la lista"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.sortOrder}
              error={fieldErrors.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Estado
              <select
                className={SELECT_CLASS}
                value={form.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.value === "active" }))
                }
              >
                <option value="active">Activo — se puede elegir para retirar</option>
                <option value="inactive">Apagado — no se ofrece</option>
              </select>
            </label>
          </div>
        </div>
      </AdminEditSheet>
    </div>
  );
}
