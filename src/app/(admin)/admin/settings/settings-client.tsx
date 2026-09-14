"use client";

import * as React from "react";
import Link from "next/link";

import { formatBusinessHoursSummary } from "@/modules/business-settings/domain/business-hours-format";
import {
  checkBusinessSettingsContrast,
  type BusinessSettingsColors,
} from "@/modules/business-settings/domain/color-contrast";
import { COLOR_PRESETS } from "@/modules/business-settings/domain/color-presets";
import {
  FONT_CHOICES,
  FONT_LABELS,
  WEEKDAY_KEYS,
  type BusinessHours,
  type WeekdayKey,
} from "@/modules/business-settings/domain/business-settings.types";
import { BrandMark } from "@/shared/ui/brand-mark";
import type { BusinessSettingsValue } from "@/shared/lib/business-settings";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { PickupPreviewPanel } from "./pickup-preview";

/**
 * Vista serializable de la configuración: es lo que viaja del servidor al
 * formulario y lo que el formulario devuelve por la API.
 */
export type BusinessSettingsDraft = Omit<BusinessSettingsValue, "businessHours"> & {
  businessHours: BusinessHours;
};

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

/** Campos de color editables, en el orden en que se muestran. */
export const COLOR_FIELDS: {
  field: keyof BusinessSettingsColors;
  label: string;
  hint?: string;
}[] = [
  { field: "primaryColor", label: "Color de marca", hint: "Botones y acentos principales." },
  { field: "backgroundColor", label: "Fondo del sitio" },
  { field: "foregroundColor", label: "Color del texto" },
  { field: "surfaceColor", label: "Fondo de las tarjetas" },
  { field: "accentColor", label: "Acento suave", hint: "Tintes y fondos secundarios." },
];

type FieldErrors = Record<string, string>;

function toDraft(settings: BusinessSettingsValue): BusinessSettingsDraft {
  return { ...settings, businessHours: settings.businessHours };
}

/** Convierte el borrador al payload que espera la API (textos vacíos → se limpian). */
export function toSettingsPayload(draft: BusinessSettingsDraft) {
  return {
    name: draft.name,
    tagline: draft.tagline,
    description: draft.description,
    logoUrl: draft.logoUrl,
    logoMarkUrl: draft.logoMarkUrl,
    faviconUrl: draft.faviconUrl,
    ogImageUrl: draft.ogImageUrl,
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
    backgroundColor: draft.backgroundColor,
    foregroundColor: draft.foregroundColor,
    surfaceColor: draft.surfaceColor,
    headingFont: draft.headingFont,
    bodyFont: draft.bodyFont,
    phone: draft.phone,
    whatsapp: draft.whatsapp,
    email: draft.email,
    instagram: draft.instagram,
    facebook: draft.facebook,
    tiktok: draft.tiktok,
    addressLine: draft.addressLine,
    city: draft.city,
    addressReference: draft.addressReference,
    mapsUrl: draft.mapsUrl,
    latitude: draft.latitude,
    longitude: draft.longitude,
    timezone: draft.timezone,
    businessHours: draft.businessHours,
    currencyCode: draft.currencyCode,
    currencySymbol: draft.currencySymbol,
    locale: draft.locale,
    usdExchangeRate: draft.usdExchangeRate,
    pickupLeadMinutes: draft.pickupLeadMinutes,
    pickupMaxMinutes: draft.pickupMaxMinutes,
    paymentInstructions: draft.paymentInstructions,
    tipEnabled: draft.tipEnabled,
    tipRate: draft.tipRate,
    isAcceptingOrders: draft.isAcceptingOrders,
    closedMessage: draft.closedMessage,
  };
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SettingsField({
  id,
  label,
  hint,
  error,
  onReset,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  onReset?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded-md px-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Restablecer
          </button>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger-strong">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default function AdminSettingsClientPage({
  initialSettings,
}: {
  initialSettings: BusinessSettingsValue;
}) {
  const savedSettings = React.useMemo(() => toDraft(initialSettings), [initialSettings]);
  const [draft, setDraft] = React.useState<BusinessSettingsDraft>(savedSettings);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [audit, setAudit] = React.useState({
    updatedAt: initialSettings.updatedAt,
    updatedByUserId: initialSettings.updatedByUserId,
  });

  function setField<K extends keyof BusinessSettingsDraft>(
    field: K,
    value: BusinessSettingsDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus("idle");
  }

  function resetField<K extends keyof BusinessSettingsDraft>(field: K) {
    setField(field, savedSettings[field]);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field as string];
      return next;
    });
  }

  function setHoursDay(weekday: WeekdayKey, patch: Partial<BusinessHours[WeekdayKey]>) {
    setDraft((current) => ({
      ...current,
      businessHours: {
        ...current.businessHours,
        [weekday]: { ...current.businessHours[weekday], ...patch },
      },
    }));
    setStatus("idle");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch("/api/admin/business-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSettingsPayload(draft)),
      });

      const payload = (await response.json().catch(() => null)) as
        | (BusinessSettingsValue & { error?: { message?: string; fields?: FieldErrors } })
        | null;

      if (!response.ok) {
        setFieldErrors(payload?.error?.fields ?? {});
        setFormError(payload?.error?.message ?? "No se pudo guardar la configuración.");
        setStatus("idle");
        return;
      }

      if (payload) {
        const next = toDraft({ ...payload, updatedAt: String(payload.updatedAt) });
        setDraft(next);
        setAudit({ updatedAt: String(payload.updatedAt), updatedByUserId: payload.updatedByUserId });
      }
      setStatus("saved");
    } catch {
      setFormError("No se pudo guardar la configuración. Revisá tu conexión.");
      setStatus("idle");
    }
  }

  const hoursSummary = formatBusinessHoursSummary(draft.businessHours);
  const contrastWarnings = checkBusinessSettingsContrast(draft);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Personalización del negocio
        </h1>
        <p className="text-sm text-muted-foreground">
          Todo lo que se muestra en el sitio público sale de acá. Los cambios se ven al
          instante, sin volver a desplegar.
        </p>
      </header>

      <PreviewCard draft={draft} />

      <SettingsSection
        title="Identidad"
        description="El nombre y los textos que identifican al negocio."
      >
        <SettingsField
          id="settings-name"
          label="Nombre *"
          error={fieldErrors.name}
          onReset={() => resetField("name")}
        >
          <Input
            id="settings-name"
            value={draft.name}
            maxLength={80}
            onChange={(event) => setField("name", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-tagline"
          label="Frase corta"
          hint="Se usa en el footer y en el manifiesto del PWA."
          error={fieldErrors.tagline}
          onReset={() => resetField("tagline")}
        >
          <Input
            id="settings-tagline"
            value={draft.tagline ?? ""}
            maxLength={160}
            onChange={(event) => setField("tagline", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-description"
          label="Descripción para buscadores"
          hint="Es la meta description del sitio."
          error={fieldErrors.description}
          onReset={() => resetField("description")}
          className="space-y-1.5 sm:col-span-2"
        >
          <Input
            id="settings-description"
            value={draft.description ?? ""}
            maxLength={300}
            onChange={(event) => setField("description", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-logo-url"
          label="Logo completo (URL)"
          hint="Se usa en el footer y las confirmaciones."
          error={fieldErrors.logoUrl}
          onReset={() => resetField("logoUrl")}
        >
          <Input
            id="settings-logo-url"
            value={draft.logoUrl ?? ""}
            onChange={(event) => setField("logoUrl", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-logo-mark-url"
          label="Isotipo (URL)"
          hint="Si lo dejás vacío, el header muestra las iniciales del nombre."
          error={fieldErrors.logoMarkUrl}
          onReset={() => resetField("logoMarkUrl")}
        >
          <Input
            id="settings-logo-mark-url"
            value={draft.logoMarkUrl ?? ""}
            onChange={(event) => setField("logoMarkUrl", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-favicon-url"
          label="Favicon (URL)"
          error={fieldErrors.faviconUrl}
          onReset={() => resetField("faviconUrl")}
        >
          <Input
            id="settings-favicon-url"
            value={draft.faviconUrl ?? ""}
            onChange={(event) => setField("faviconUrl", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-og-image-url"
          label="Imagen para compartir (URL)"
          error={fieldErrors.ogImageUrl}
          onReset={() => resetField("ogImageUrl")}
        >
          <Input
            id="settings-og-image-url"
            value={draft.ogImageUrl ?? ""}
            onChange={(event) => setField("ogImageUrl", event.target.value)}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Contacto y ubicación"
        description="Se muestra en el footer y en la ficha del negocio."
      >
        <SettingsField
          id="settings-phone"
          label="Teléfono"
          hint="Formato E.164, por ejemplo +12025550123."
          error={fieldErrors.phone}
          onReset={() => resetField("phone")}
        >
          <Input
            id="settings-phone"
            value={draft.phone ?? ""}
            onChange={(event) => setField("phone", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-whatsapp"
          label="WhatsApp"
          hint="E.164 sin +, por ejemplo 12025550123."
          error={fieldErrors.whatsapp}
          onReset={() => resetField("whatsapp")}
        >
          <Input
            id="settings-whatsapp"
            value={draft.whatsapp ?? ""}
            onChange={(event) => setField("whatsapp", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-email"
          label="Correo"
          error={fieldErrors.email}
          onReset={() => resetField("email")}
        >
          <Input
            id="settings-email"
            value={draft.email ?? ""}
            onChange={(event) => setField("email", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-instagram"
          label="Instagram"
          hint="Solo el usuario, sin @."
          error={fieldErrors.instagram}
          onReset={() => resetField("instagram")}
        >
          <Input
            id="settings-instagram"
            value={draft.instagram ?? ""}
            onChange={(event) => setField("instagram", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-facebook"
          label="Facebook"
          error={fieldErrors.facebook}
          onReset={() => resetField("facebook")}
        >
          <Input
            id="settings-facebook"
            value={draft.facebook ?? ""}
            onChange={(event) => setField("facebook", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-tiktok"
          label="TikTok"
          error={fieldErrors.tiktok}
          onReset={() => resetField("tiktok")}
        >
          <Input
            id="settings-tiktok"
            value={draft.tiktok ?? ""}
            onChange={(event) => setField("tiktok", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-address"
          label="Dirección"
          error={fieldErrors.addressLine}
          onReset={() => resetField("addressLine")}
        >
          <Input
            id="settings-address"
            value={draft.addressLine ?? ""}
            onChange={(event) => setField("addressLine", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-city"
          label="Ciudad"
          error={fieldErrors.city}
          onReset={() => resetField("city")}
        >
          <Input
            id="settings-city"
            value={draft.city ?? ""}
            onChange={(event) => setField("city", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-address-reference"
          label="Referencia"
          error={fieldErrors.addressReference}
          onReset={() => resetField("addressReference")}
          className="space-y-1.5 sm:col-span-2"
        >
          <Input
            id="settings-address-reference"
            value={draft.addressReference ?? ""}
            onChange={(event) => setField("addressReference", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-maps-url"
          label="Enlace al mapa (URL)"
          error={fieldErrors.mapsUrl}
          onReset={() => resetField("mapsUrl")}
        >
          <Input
            id="settings-maps-url"
            value={draft.mapsUrl ?? ""}
            onChange={(event) => setField("mapsUrl", event.target.value)}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Horarios"
        description="Son informativos: se muestran en el footer y en el checkout."
      >
        <div className="sm:col-span-2">
          <p className="rounded-xl border border-border bg-accent/60 px-4 py-3 text-sm font-medium text-foreground">
            {hoursSummary}
          </p>
          {fieldErrors.businessHours ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger-strong">
              {fieldErrors.businessHours}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {WEEKDAY_KEYS.map((weekday) => (
              <div
                key={weekday}
                className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background/60 p-3"
              >
                <span className="min-w-24 text-sm font-medium text-foreground">
                  {WEEKDAY_LABELS[weekday]}
                </span>
                <div className="space-y-1.5">
                  <label
                    htmlFor={`hours-${weekday}-open`}
                    className="block text-xs text-muted-foreground"
                  >
                    Abre
                  </label>
                  <Input
                    id={`hours-${weekday}-open`}
                    type="time"
                    value={draft.businessHours[weekday].open}
                    disabled={draft.businessHours[weekday].closed}
                    onChange={(event) => setHoursDay(weekday, { open: event.target.value })}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor={`hours-${weekday}-close`}
                    className="block text-xs text-muted-foreground"
                  >
                    Cierra
                  </label>
                  <Input
                    id={`hours-${weekday}-close`}
                    type="time"
                    value={draft.businessHours[weekday].close}
                    disabled={draft.businessHours[weekday].closed}
                    onChange={(event) => setHoursDay(weekday, { close: event.target.value })}
                    className="w-32"
                  />
                </div>
                <div className="min-h-11 flex items-center">
                  <Checkbox
                    id={`hours-${weekday}-closed`}
                    checked={draft.businessHours[weekday].closed}
                    onChange={(event) =>
                      setHoursDay(weekday, { closed: event.target.checked })
                    }
                    label="Cerrado"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Operación"
        description="Retiro, pago y propina."
      >
        <SettingsField
          id="settings-pickup-lead"
          label="Minutos de preparación"
          hint="Cuánto tardás como mínimo desde que entra el pedido hasta que está listo. Define el primer turno de retiro y hasta qué hora se puede pedir: con 25, la última orden entra 25 minutos antes del cierre."
          error={fieldErrors.pickupLeadMinutes}
          onReset={() => resetField("pickupLeadMinutes")}
        >
          <Input
            id="settings-pickup-lead"
            type="number"
            min={0}
            max={180}
            value={String(draft.pickupLeadMinutes)}
            onChange={(event) =>
              setField("pickupLeadMinutes", Number(event.target.value || 0))
            }
          />
        </SettingsField>

        <SettingsField
          id="settings-pickup-max"
          label="Máximo del rango (opcional)"
          hint="Si lo completás, el cliente ve “listo entre X y Y” en vez de una hora exacta. Tiene que ser mayor o igual que los minutos de preparación; vacío = una sola hora."
          error={fieldErrors.pickupMaxMinutes}
          onReset={() => resetField("pickupMaxMinutes")}
        >
          <Input
            id="settings-pickup-max"
            type="number"
            min={0}
            max={240}
            value={draft.pickupMaxMinutes === null ? "" : String(draft.pickupMaxMinutes)}
            placeholder="Sin rango"
            onChange={(event) =>
              setField(
                "pickupMaxMinutes",
                event.target.value.trim() === "" ? null : Number(event.target.value),
              )
            }
          />
        </SettingsField>

        <SettingsField
          id="settings-timezone"
          label="Zona horaria"
          // El ejemplo es del **formato** (`Region/Ciudad`), a propósito en otra zona: el dato del
          // negocio vive en la configuración, no en el código (`anti-hardcode-contract`).
          hint="Formato IANA, por ejemplo America/Bogota."
          error={fieldErrors.timezone}
          onReset={() => resetField("timezone")}
        >
          <Input
            id="settings-timezone"
            value={draft.timezone}
            onChange={(event) => setField("timezone", event.target.value)}
          />
        </SettingsField>

        {/* Fase 2: la vista previa cierra el círculo de los cuatro campos de arriba
            (horario, preparación, rango y zona): muestra los turnos y la última orden
            que vería el cliente con lo que está en pantalla, sin guardar nada. */}
        <div className="sm:col-span-2">
          <PickupPreviewPanel
            businessHours={draft.businessHours}
            timezone={draft.timezone}
            pickupLeadMinutes={draft.pickupLeadMinutes}
            pickupMaxMinutes={draft.pickupMaxMinutes}
          />
        </div>

        <SettingsField
          id="settings-currency-code"
          label="Moneda (ISO)"
          hint="Tres letras, por ejemplo NIO."
          error={fieldErrors.currencyCode}
          onReset={() => resetField("currencyCode")}
        >
          <Input
            id="settings-currency-code"
            value={draft.currencyCode}
            maxLength={3}
            onChange={(event) => setField("currencyCode", event.target.value.toUpperCase())}
          />
        </SettingsField>

        <SettingsField
          id="settings-currency-symbol"
          label="Símbolo"
          error={fieldErrors.currencySymbol}
          onReset={() => resetField("currencySymbol")}
        >
          <Input
            id="settings-currency-symbol"
            value={draft.currencySymbol}
            maxLength={8}
            onChange={(event) => setField("currencySymbol", event.target.value)}
          />
        </SettingsField>

        <SettingsField
          id="settings-usd-exchange-rate"
          label="Tipo de cambio del dólar"
          hint="Cuánto vale US$1 en tu moneda. Vacío: los cobros en dólares se rechazan hasta cargarlo."
          error={fieldErrors.usdExchangeRate}
          onReset={() => resetField("usdExchangeRate")}
        >
          <Input
            id="settings-usd-exchange-rate"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft.usdExchangeRate === null ? "" : String(draft.usdExchangeRate)}
            onChange={(event) =>
              setField(
                "usdExchangeRate",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </SettingsField>

        <SettingsField
          id="settings-tip-rate"
          label="Propina sugerida (%)"
          hint="El servidor calcula la propina con este porcentaje."
          error={fieldErrors.tipRate}
          onReset={() => resetField("tipRate")}
        >
          <Input
            id="settings-tip-rate"
            type="number"
            min={0}
            max={100}
            value={String(draft.tipRate)}
            disabled={!draft.tipEnabled}
            onChange={(event) => setField("tipRate", Number(event.target.value || 0))}
          />
        </SettingsField>

        <SettingsField
          id="settings-payment-instructions"
          label="Texto de pago"
          error={fieldErrors.paymentInstructions}
          onReset={() => resetField("paymentInstructions")}
          className="space-y-1.5 sm:col-span-2"
        >
          <Input
            id="settings-payment-instructions"
            value={draft.paymentInstructions ?? ""}
            maxLength={400}
            onChange={(event) => setField("paymentInstructions", event.target.value)}
          />
        </SettingsField>

        <div className="flex min-h-11 items-center">
          <Checkbox
            id="settings-tip-enabled"
            checked={draft.tipEnabled}
            onChange={(event) => setField("tipEnabled", event.target.checked)}
            label="Ofrecer propina"
          />
        </div>

        {/* T8 fase 7: "aceptando pedidos" y su mensaje de cerrado son **por local**.
            Acá eran un control que no hacía lo que decía: con cualquier local cargado
            (la migración crea el primario) manda el del local y este no cambiaba nada.
            Los valores guardados siguen viajando en el payload porque son el respaldo
            del servidor cuando el negocio no tiene ningún local. */}
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Si aceptás pedidos, el horario de retiro y los minutos de preparación se
          configuran por local:{" "}
          <Link href="/admin/locations" className="font-semibold text-brand hover:underline">
            Locales
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection
        title="Apariencia"
        description="Colores y tipografías del sitio. Los avisos de contraste no bloquean el guardado."
      >
        <div className="space-y-2 sm:col-span-2">
          <p className="text-sm font-medium text-foreground">Presets</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => {
              const isActive = Object.entries(preset.colors).every(
                ([key, value]) =>
                  draft[key as keyof BusinessSettingsColors] === value,
              );

              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isActive}
                  title={preset.description}
                  onClick={() => {
                    setDraft((current) => ({ ...current, ...preset.colors }));
                    setStatus("idle");
                  }}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isActive
                      ? "border-brand bg-accent text-foreground"
                      : "border-border bg-card text-foreground hover:border-brand/40"
                  }`}
                >
                  <span className="flex gap-0.5" aria-hidden="true">
                    {[
                      preset.colors.primaryColor,
                      preset.colors.accentColor,
                      preset.colors.backgroundColor,
                    ].map((color) => (
                      <span
                        key={color}
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {COLOR_FIELDS.map(({ field, label, hint }) => (
          <SettingsField
            key={field}
            id={`settings-${field}`}
            label={label}
            hint={hint}
            error={fieldErrors[field]}
            onReset={() => resetField(field)}
          >
            <div className="flex items-center gap-2">
              <input
                id={`settings-${field}`}
                type="color"
                value={draft[field]}
                onChange={(event) => setField(field, event.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
              />
              <Input
                aria-label={`${label} en hexadecimal`}
                value={draft[field]}
                maxLength={7}
                onChange={(event) => setField(field, event.target.value)}
                className="font-mono"
              />
            </div>
          </SettingsField>
        ))}

        <div className="space-y-2 sm:col-span-2">
          <p className="text-sm font-medium text-foreground">Contraste</p>
          {contrastWarnings.length === 0 ? (
            <p className="rounded-xl border border-border bg-success/60 px-4 py-3 text-sm text-success-foreground">
              Los colores elegidos cumplen el contraste mínimo (WCAG AA). ✓
            </p>
          ) : (
            <ul className="space-y-2">
              {contrastWarnings.map((warning) => (
                <li
                  key={warning.id}
                  className="rounded-xl border border-warning-strong/50 bg-warning/70 px-4 py-3 text-sm text-warning-foreground"
                >
                  <strong className="font-semibold">{warning.label}</strong>: contraste{" "}
                  {warning.ratio}:1, hace falta {warning.required}:1. El sitio puede quedar
                  difícil de leer, pero podés guardar igual.
                </li>
              ))}
            </ul>
          )}
        </div>

        <SettingsField
          id="settings-heading-font"
          label="Tipografía de títulos"
          error={fieldErrors.headingFont}
          onReset={() => resetField("headingFont")}
        >
          <select
            id="settings-heading-font"
            value={draft.headingFont}
            onChange={(event) =>
              setField("headingFont", event.target.value as BusinessSettingsDraft["headingFont"])
            }
            className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {FONT_CHOICES.map((font) => (
              <option key={font} value={font}>
                {FONT_LABELS[font]}
              </option>
            ))}
          </select>
        </SettingsField>

        <SettingsField
          id="settings-body-font"
          label="Tipografía de texto"
          error={fieldErrors.bodyFont}
          onReset={() => resetField("bodyFont")}
        >
          <select
            id="settings-body-font"
            value={draft.bodyFont}
            onChange={(event) =>
              setField("bodyFont", event.target.value as BusinessSettingsDraft["bodyFont"])
            }
            className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {FONT_CHOICES.map((font) => (
              <option key={font} value={font}>
                {FONT_LABELS[font]}
              </option>
            ))}
          </select>
        </SettingsField>
      </SettingsSection>

      {/* La barra sangra hasta los bordes del `<main>` del admin, que tiene px-3 / sm:px-4 /
          md:px-7. Con -mx-4 como estaba, a 375 px se salía 4 px y la página scrolleaba de
          costado. */}
      <div className="sticky bottom-0 -mx-3 border-t border-border bg-card/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:-mx-7 md:px-7">
        {formError ? (
          <p role="alert" className="mb-2 text-sm font-medium text-danger-strong">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {audit.updatedByUserId
              ? `Última edición: ${new Date(audit.updatedAt).toLocaleString("es-NI")} · ${audit.updatedByUserId}`
              : `Última edición: ${new Date(audit.updatedAt).toLocaleString("es-NI")}`}
          </p>
          <div className="flex items-center gap-3">
            {status === "saved" ? (
              <span className="text-sm font-medium text-success-foreground">
                Cambios guardados ✓
              </span>
            ) : null}
            <Button type="submit" disabled={status === "saving"} className="min-h-11">
              {status === "saving" ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Vista previa en vivo: header, botón y tarjeta con lo que se está editando. */
function PreviewCard({ draft }: { draft: BusinessSettingsDraft }) {
  return (
    <section
      aria-label="Vista previa"
      className="rounded-2xl border border-border p-5"
      style={
        {
          "--brand": draft.primaryColor,
          "--accent": draft.accentColor,
          "--background": draft.backgroundColor,
          "--foreground": draft.foregroundColor,
          "--card": draft.surfaceColor,
        } as React.CSSProperties
      }
    >
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Vista previa
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Así se va a ver el sitio con lo que estás editando (todavía sin guardar).
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: draft.backgroundColor }}
        >
          <BrandMark
            brand={draft}
            variant="full"
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
            fallbackClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
          />
          <span
            className="font-semibold"
            style={{
              color: draft.foregroundColor,
              // Se deriva de la elección: con un ternario, la tercera
              // tipografía se previsualizaba como Inter.
              fontFamily: `var(--font-${draft.headingFont})`,
            }}
          >
            {draft.name || "Nombre del negocio"}
          </span>
        </div>

        <div
          className="space-y-3 p-4"
          style={{ backgroundColor: draft.backgroundColor }}
        >
          <div
            className="rounded-xl border border-border p-3"
            style={{ backgroundColor: draft.surfaceColor }}
          >
            <p className="text-sm font-semibold" style={{ color: draft.foregroundColor }}>
              {draft.tagline || "Frase corta del negocio"}
            </p>
            {draft.paymentInstructions ? (
              <p className="mt-1 text-xs" style={{ color: draft.foregroundColor, opacity: 0.7 }}>
                {draft.paymentInstructions}
              </p>
            ) : null}
          </div>
          <span
            className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
            style={{ backgroundColor: draft.primaryColor, color: "#ffffff" }}
          >
            Confirmar pedido
          </span>
        </div>
      </div>
    </section>
  );
}
