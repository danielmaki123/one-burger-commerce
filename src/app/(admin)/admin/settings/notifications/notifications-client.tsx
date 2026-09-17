"use client";

import * as React from "react";
import Link from "next/link";

import {
  resolveTelegramStatus,
  type NotificationSettingsRecord,
  type TelegramStatus,
} from "@/modules/notifications/domain/notification-settings";
import {
  TELEGRAM_EVENTS,
  TELEGRAM_EVENT_DESCRIPTIONS,
  TELEGRAM_EVENT_LABELS,
  type TelegramEvent,
} from "@/modules/notifications/domain/telegram-events";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

/**
 * Parte 3 del brief (alertas Telegram) — la sección «Alertas Telegram» del admin.
 *
 * Muestra el **estado** (conectado / desconectado / sin configurar / sin token), deja pegar el `chat_id`,
 * probar la conexión con un **mensaje real** y elegir qué eventos reenviar. Los eventos que no se eligen
 * **siguen registrándose en el sistema**: el brief es explícito en que el owner decide qué reenviar, no
 * qué existe.
 *
 * Los errores de la prueba se muestran tal como los traduce el servidor («el bot no está en el grupo»,
 * «chat_id inválido», «falta el token»): son problemas distintos y se arreglan distinto.
 */

const STATUS_LABEL: Record<TelegramStatus, string> = {
  conectado: "Conectado",
  desconectado: "Desconectado",
  "sin-configurar": "Sin configurar",
  "sin-token": "Falta el token en el servidor",
};

const STATUS_CLASS: Record<TelegramStatus, string> = {
  conectado:
    "border-status-ready-border bg-status-ready-bg text-status-ready-text",
  desconectado: "border-status-prep-border bg-status-prep-bg text-status-prep-text",
  "sin-configurar": "border-line-subtle bg-surface-elevated text-ink-secondary",
  "sin-token": "border-status-sla-border bg-status-sla-bg text-status-sla-text",
};

function formatLastSend(iso: string | null, timezone: string, locale: string): string {
  if (!iso) return "Todavía no se mandó nada.";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Todavía no se mandó nada.";

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationsClient({
  initialSettings,
  tokenConfigured,
}: {
  initialSettings: NotificationSettingsRecord;
  tokenConfigured: boolean;
}) {
  const currency = useCurrencyFormat();
  const { timezone, locale } = useBusinessSettings();
  const [settings, setSettings] = React.useState(initialSettings);
  const [chatId, setChatId] = React.useState(initialSettings.chatId ?? "");
  const [refundThreshold, setRefundThreshold] = React.useState(
    String(initialSettings.refundAlertThreshold),
  );
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const status = resolveTelegramStatus(settings, { tokenConfigured });

  async function send(method: "PATCH" | "POST", body?: unknown, url = "/api/admin/settings/notifications") {
    const response = await fetch(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: NotificationSettingsRecord; error?: { message?: string } }
      | null;

    return { ok: response.ok, payload };
  }

  async function save(next: Partial<NotificationSettingsRecord> & { chatId?: string | null }) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { ok, payload } = await send("PATCH", {
        chatId: next.chatId === undefined ? chatId.trim() : next.chatId,
        ...(next.enabled === undefined ? {} : { enabled: next.enabled }),
        ...(next.eventsEnabled === undefined ? {} : { eventsEnabled: next.eventsEnabled }),
        refundAlertThreshold: Number(refundThreshold.replace(",", ".")) || 0,
      });

      if (!ok || !payload?.data) {
        setError(payload?.error?.message ?? "No se pudo guardar la configuración.");
        return;
      }

      setSettings(payload.data);
      setChatId(payload.data.chatId ?? "");
      setMessage("Guardado.");
    } catch {
      setError("No se pudo guardar: revisá la conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError(null);
    setMessage(null);

    try {
      const { ok, payload } = await send("POST", undefined, "/api/admin/settings/notifications/test");

      if (!ok) {
        setError(payload?.error?.message ?? "No se pudo probar la conexión.");
        // El resultado de la prueba también queda guardado (último envío / último error).
        const refreshed = await send("PATCH", { chatId: chatId.trim() });
        if (refreshed.payload?.data) setSettings(refreshed.payload.data);
        return;
      }

      setMessage("Mensaje de prueba enviado. Revisá el grupo.");
      const refreshed = await send("PATCH", { chatId: chatId.trim() });
      if (refreshed.payload?.data) setSettings(refreshed.payload.data);
    } catch {
      setError("No se pudo probar la conexión: revisá la red.");
    } finally {
      setTesting(false);
    }
  }

  function toggleEvent(event: TelegramEvent) {
    const next = settings.eventsEnabled.includes(event)
      ? settings.eventsEnabled.filter((current) => current !== event)
      : [...settings.eventsEnabled, event];

    setSettings({ ...settings, eventsEnabled: next });
    void save({ eventsEnabled: next });
  }

  const toggle =
    "flex min-h-11 items-center justify-between gap-3 rounded-stitch-lg border border-line-subtle bg-surface-elevated px-3 py-2";

  return (
    <div className="space-y-4">
      <section
        aria-label="Estado de las alertas"
        className={`space-y-2 rounded-stitch-lg border p-4 ${STATUS_CLASS[status]}`}
      >
        <p className="text-st-overline font-bold uppercase tracking-wider">Estado</p>
        <p className="text-st-h3 font-semibold">{STATUS_LABEL[status]}</p>
        <p className="text-st-body">
          Último envío: {formatLastSend(settings.lastSentAt, timezone, locale)}
          {settings.lastError ? ` · Último error: ${settings.lastError}` : ""}
        </p>
        {!tokenConfigured ? (
          <p className="text-st-body">
            Falta <span className="font-mono">TELEGRAM_BOT_TOKEN</span> en el servidor: el bot lo
            configura el administrador del sistema.
          </p>
        ) : null}
      </section>

      <section
        aria-label="Grupo de Telegram"
        className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Grupo</h2>
        <p className="text-st-body text-ink-secondary">
          Agregá el bot al grupo y pegá acá su id (los grupos nuevos empiezan con{" "}
          <span className="font-mono">-100</span>; los viejos, con{" "}
          <span className="font-mono">-</span> y menos dígitos) o el{" "}
          <span className="font-mono">@canal</span>.
        </p>

        <Input
          label="Chat ID"
          value={chatId}
          placeholder="-1001234567890"
          onChange={(event) => setChatId(event.target.value)}
          error={error ?? undefined}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={saving || chatId.trim() === ""}
            onClick={() => void save({ enabled: true })}
          >
            {saving ? "Guardando…" : "Guardar y activar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={testing || chatId.trim() === ""}
            onClick={() => void testConnection()}
          >
            {testing ? "Probando…" : "Probar conexión"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={saving}
            onClick={() => void save({ enabled: false })}
          >
            Desactivar alertas
          </Button>
          <Link
            href="/admin/settings"
            className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
          >
            Volver a Personalización
          </Link>
        </div>

        {message ? (
          <p role="status" className="text-st-body font-medium text-status-ready-text">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-st-body font-medium text-status-sla-text">
            {error}
          </p>
        ) : null}
      </section>

      <section
        aria-label="Eventos que se avisan"
        className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Qué te avisamos</h2>
        <p className="text-st-body text-ink-secondary">
          Todo queda registrado en el sistema; acá elegís qué se reenvía al grupo.
        </p>

        <ul className="space-y-2">
          {TELEGRAM_EVENTS.map((event) => (
            <li key={event} className={toggle}>
              <span>
                <span className="block text-st-body font-semibold text-ink">
                  {TELEGRAM_EVENT_LABELS[event]}
                </span>
                <span className="block text-st-caption text-ink-secondary">
                  {TELEGRAM_EVENT_DESCRIPTIONS[event]}
                </span>
              </span>
              <Checkbox
                label={`Avisar: ${TELEGRAM_EVENT_LABELS[event]}`}
                checked={settings.eventsEnabled.includes(event)}
                onChange={() => toggleEvent(event)}
              />
            </li>
          ))}
        </ul>

        {/*
          Decisión del owner (2026-09-17): el umbral de diferencia **desapareció de la pantalla**. Antes
          decidía si una diferencia avisaba; ahora el cierre de caja avisa siempre y cualquier diferencia se
          destaca en ese mismo mensaje, así que el campo era un control sin efecto (y ya no se manda).
        */}
        <Input
          label={`Devolución mayor a (${currency.symbol})`}
          value={refundThreshold}
          onChange={(event) => setRefundThreshold(event.target.value)}
        />

        {/* Los umbrales vigentes, en palabras: el input dice lo que se va a guardar y esto lo que rige. */}
        <p className="text-st-body text-ink-secondary">
          Hoy avisamos devoluciones de más de{" "}
          <span className="font-mono tabular-nums text-ink">
            {formatCurrency(settings.refundAlertThreshold, currency)}
          </span>{" "}
          y <strong className="font-semibold text-ink">todas las diferencias de caja</strong>, en el mensaje
          de cierre de cada turno.
        </p>

        <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => void save({})}>
          {saving ? "Guardando…" : "Guardar umbrales"}
        </Button>
      </section>
    </div>
  );
}
