"use client";

import { WEEKDAY_KEYS } from "@/modules/business-settings/domain/business-settings.types";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

import AdminEditSheet from "../_components/admin-edit-sheet";
import { WEEKDAY_LABELS, type LocationFormState } from "./location-helpers";

type LocationFormSheetProps = {
  open: boolean;
  isNew: boolean;
  /** Nombre del local que se está editando: nombra el botón de borrar. */
  locationName: string;
  title: string;
  form: LocationFormState;
  fieldErrors: Record<string, string>;
  saving: boolean;
  /** Con una sola sucursal no hay a quién copiarle el horario. */
  canApplyHoursToAll: boolean;
  onChange: (patch: Partial<LocationFormState>) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onApplyHoursToAll: () => void;
};

/**
 * Alta y edición de un local en la hoja del panel (`AdminEditSheet`, la misma del KDS y del Menú).
 *
 * El editor de horario cubre los **siete** días con horas de 24 h: la referencia del sistema solo
 * dibuja de lunes a viernes en formato de 12 h, y el backend guarda los siete días en `HH:mm`.
 */
export function LocationFormSheet({
  open,
  isNew,
  locationName,
  title,
  form,
  fieldErrors,
  saving,
  canApplyHoursToAll,
  onChange,
  onClose,
  onSave,
  onDelete,
  onApplyHoursToAll,
}: LocationFormSheetProps) {
  function setHours(weekday: (typeof WEEKDAY_KEYS)[number], patch: Partial<LocationFormState["businessHours"][typeof weekday]>) {
    onChange({
      businessHours: {
        ...form.businessHours,
        [weekday]: { ...form.businessHours[weekday], ...patch },
      },
    });
  }

  return (
    <AdminEditSheet
      open={open}
      onClose={onClose}
      kicker={isNew ? "Locales" : "Editar local"}
      title={title}
      footer={
        <div className="flex flex-wrap gap-2">
          {isNew ? null : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              aria-label={`Eliminar local ${locationName}`}
              onClick={onDelete}
            >
              Eliminar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Guardando…" : isNew ? "Crear local" : "Guardar cambios"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Input
          label="Nombre"
          value={form.name}
          error={fieldErrors.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ej. Sucursal Norte"
        />

        <div>
          <Input
            label="Identificador para la URL"
            value={form.slug}
            error={fieldErrors.slug}
            onChange={(event) => onChange({ slug: event.target.value })}
            placeholder="sucursal-norte"
          />
          <p className="mt-1 text-st-caption text-ink-secondary">
            Se guarda en minúsculas y con guiones. Es el nombre corto del local.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Dirección"
            value={form.addressLine}
            error={fieldErrors.addressLine}
            onChange={(event) => onChange({ addressLine: event.target.value })}
          />
          <Input
            label="Ciudad"
            value={form.city}
            error={fieldErrors.city}
            onChange={(event) => onChange({ city: event.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Referencia"
            value={form.addressReference}
            onChange={(event) => onChange({ addressReference: event.target.value })}
            placeholder="Ej. frente al parque"
          />
          <Input
            label="Enlace al mapa"
            value={form.mapsUrl}
            onChange={(event) => onChange({ mapsUrl: event.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
          />
          <Input
            label="WhatsApp del local"
            value={form.whatsapp}
            error={fieldErrors.whatsapp}
            onChange={(event) => onChange({ whatsapp: event.target.value })}
            placeholder="50588887777"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitud"
            value={form.latitude}
            error={fieldErrors.latitude}
            onChange={(event) => onChange({ latitude: event.target.value })}
            placeholder="11.85"
          />
          <Input
            label="Longitud"
            value={form.longitude}
            error={fieldErrors.longitude}
            onChange={(event) => onChange({ longitude: event.target.value })}
            placeholder="-86.20"
          />
        </div>

        <fieldset className="grid gap-3 rounded-stitch-md border border-line-subtle p-3">
          <legend className="px-1 text-st-body font-semibold text-ink">Horario del local</legend>
          {fieldErrors.businessHours ? (
            <p role="alert" className="text-st-caption font-medium text-status-sla-text">
              {fieldErrors.businessHours}
            </p>
          ) : null}
          {WEEKDAY_KEYS.map((weekday) => (
            <div key={weekday} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
              <span className="pb-2 text-st-body text-ink">{WEEKDAY_LABELS[weekday]}</span>
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
              <div className="flex min-h-11 items-center">
                <Checkbox
                  id={`location-hours-${weekday}-closed`}
                  checked={form.businessHours[weekday].closed}
                  onChange={(event) => setHours(weekday, { closed: event.target.checked })}
                  label={`Cerrado ${WEEKDAY_LABELS[weekday]}`}
                />
              </div>
            </div>
          ))}
          {canApplyHoursToAll ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
              <p className="text-st-caption text-ink-secondary">
                El horario vive en cada sucursal. Este botón lo copia a las demás.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={saving}
                onClick={onApplyHoursToAll}
              >
                Aplicar a todas las sucursales
              </Button>
            </div>
          ) : null}
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
            onChange={(event) => onChange({ pickupLeadMinutes: event.target.value })}
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
              onChange={(event) => onChange({ pickupMaxMinutes: event.target.value })}
              placeholder="Sin rango"
            />
            <p className="mt-1 text-st-caption text-ink-secondary">
              Vacío = el cliente ve una sola hora.
            </p>
          </div>
        </div>
        <p className="-mt-2 text-st-caption text-ink-secondary">
          Los minutos de preparación definen el primer turno de retiro y hasta qué hora entra un
          pedido en este local.
        </p>

        {/*
          B5 — con qué minutos avisa el tablero de comandas de este local. Un pedido sin aceptar es lo
          más urgente que hay (nadie lo tomó), y en cocina el ritmo lo pone la sucursal.
        */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="Aviso sin aceptar (min)"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={form.acceptAlertMinutes}
              error={fieldErrors.acceptAlertMinutes}
              onChange={(event) => onChange({ acceptAlertMinutes: event.target.value })}
            />
            <p className="mt-1 text-st-caption text-ink-secondary">
              Cuánto puede esperar un pedido sin que nadie lo acepte.
            </p>
          </div>
          <div>
            <Input
              label="Aviso en cocina (min)"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={form.prepAlertMinutes}
              error={fieldErrors.prepAlertMinutes}
              onChange={(event) => onChange({ prepAlertMinutes: event.target.value })}
            />
            <p className="mt-1 text-st-caption text-ink-secondary">
              Cuánto puede estar preparándose (o esperando listo) antes de avisar.
            </p>
          </div>
        </div>

        <Select
          label="Aceptando pedidos"
          value={form.isAcceptingOrders ? "yes" : "no"}
          onChange={(event) => onChange({ isAcceptingOrders: event.target.value === "yes" })}
          options={[
            { value: "yes", label: "Sí, está recibiendo pedidos" },
            { value: "no", label: "No, pausado" },
          ]}
        />

        <Select
          label="Punto de venta"
          value={form.posEnabled ? "yes" : "no"}
          onChange={(event) => onChange({ posEnabled: event.target.value === "yes" })}
          options={[
            { value: "yes", label: "Encendido — el local cobra en el mostrador" },
            { value: "no", label: "Apagado — solo pedidos en línea" },
          ]}
        />

        {/* Tarea 3 del brief (2026-09-17): el cierre obligatorio se decide **por sucursal** (1.7). */}
        <Select
          label="Cierre de caja obligatorio"
          value={form.requireShiftClose ? "yes" : "no"}
          onChange={(event) => onChange({ requireShiftClose: event.target.value === "yes" })}
          options={[
            { value: "no", label: "No — la caja puede quedar abierta" },
            { value: "yes", label: "Sí — hay que cerrarla todos los días" },
          ]}
        />

        <p className="text-st-caption text-ink-secondary">
          Con el cierre obligatorio, si la caja quedó abierta de otro día el POS no deja cobrar hasta
          cerrarla (se cierra desde «Caja»).
        </p>

        <Input
          label="Mensaje cuando no acepta"
          value={form.closedMessage}
          error={fieldErrors.closedMessage}
          onChange={(event) => onChange({ closedMessage: event.target.value })}
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
            onChange={(event) => onChange({ sortOrder: event.target.value })}
          />
          <Select
            label="Estado"
            value={form.isActive ? "active" : "inactive"}
            onChange={(event) => onChange({ isActive: event.target.value === "active" })}
            options={[
              { value: "active", label: "Activo — se puede elegir para retirar" },
              { value: "inactive", label: "Apagado — no se ofrece" },
            ]}
          />
        </div>
      </div>
    </AdminEditSheet>
  );
}
