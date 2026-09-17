"use client";

import * as React from "react";

import type { NotificationSettingsRecord, TelegramStatus } from "@/modules/notifications/domain/notification-settings";
import { resolveTelegramStatus } from "@/modules/notifications/domain/notification-settings";
import type { TelegramAlertHistoryRow } from "@/modules/notifications/features/list-telegram-alert-history/list-telegram-alert-history";
import {
  TELEGRAM_EVENTS,
  TELEGRAM_EVENT_DESCRIPTIONS,
  TELEGRAM_EVENT_LABELS,
  type TelegramEvent,
} from "@/modules/notifications/domain/telegram-events";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatRelativeTime } from "@/shared/lib/relative-time";
import { formatShiftDateTime } from "@/app/(admin)/admin/cash/cash-shift-helpers";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Toast } from "@/shared/ui/toast";
import { Toggle } from "@/shared/ui/toggle";

/**
 * Decisión del owner (2026-09-17) — la **pantalla de alertas**, rediseñada.
 *
 * Cuatro bloques, en el orden en que se usa: el **estado** (¿está andando?), la **configuración** (a qué
 * grupo), los **eventos** (qué se avisa) y el **historial** (¿salió?). Todo con los tokens del panel oscuro
 * —nada de tarjetas claras— y con el ámbar del negocio en lo que está prendido y en la acción principal.
 *
 * Tres reglas de interacción que pidió el owner y que están acá:
 *
 * 1. Los eventos se prenden con **interruptores** (no casillas) y el cambio se guarda al toque.
 * 2. El umbral de devoluciones **solo aparece si ese aviso está prendido**: un umbral de algo apagado es
 *    un control sin efecto.
 * 3. «Guardar» está **apagado mientras no haya cambios**: un botón que se puede apretar para no hacer nada
 *    es una invitación a dudar de si guardó.
 *
 * No se toca la lógica de envío: la pantalla lee y escribe la misma configuración de siempre.
 */

const EVENT_ICONS: Record<TelegramEvent, string> = {
  shift_closed: "🔒",
  shift_open_over_24h: "⏰",
  refund_over_threshold: "💸",
};

const STATUS_LABEL: Record<TelegramStatus, string> = {
  conectado: "Conectado",
  desconectado: "Desconectado",
  "sin-configurar": "Sin configurar",
  "sin-token": "Falta el token en el servidor",
};

/** El borde izquierdo de 4 px y el punto dicen el estado de un vistazo. */
const STATUS_TONE: Record<TelegramStatus, { card: string; dot: string }> = {
  conectado: { card: "border-l-brand-amber", dot: "bg-status-ready-text" },
  desconectado: { card: "border-l-status-sla-text", dot: "bg-status-sla-text" },
  "sin-configurar": { card: "border-l-line-subtle", dot: "bg-ink-muted" },
  "sin-token": { card: "border-l-status-sla-text", dot: "bg-status-sla-text" },
};

const HISTORY_LIMIT = 5;

export default function NotificationsClient({
  initialSettings,
  tokenConfigured,
  botUsername,
  history,
}: {
  initialSettings: NotificationSettingsRecord;
  tokenConfigured: boolean;
  /** `@usuario` del bot configurado. `null` = el servidor no pudo preguntarle a Telegram. */
  botUsername: string | null;
  /** Los últimos envíos, del más nuevo al más viejo (los arma el servidor desde el outbox). */
  history: TelegramAlertHistoryRow[];
}) {
  const currency = useCurrencyFormat();
  const { timezone, locale } = useBusinessSettings();
  const [settings, setSettings] = React.useState(initialSettings);
  const [chatId, setChatId] = React.useState(initialSettings.chatId ?? "");
  const [refundThreshold, setRefundThreshold] = React.useState(
    String(initialSettings.refundAlertThreshold),
  );
  const [saving, setSaving] = React.useState(false);
  const [savingEvent, setSavingEvent] = React.useState<TelegramEvent | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [toast, setToast] = React.useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );
  const [showAllHistory, setShowAllHistory] = React.useState(false);
  const [now, setNow] = React.useState<string | null>(null);
  const chatInputId = React.useId();

  const status = resolveTelegramStatus(settings, { tokenConfigured });
  const tone = STATUS_TONE[status];
  const trimmedChatId = chatId.trim();
  const hasChanges = trimmedChatId !== (settings.chatId ?? "").trim() || !settings.enabled;

  // «Hace 2 h» se calcula en el navegador (el reloj del servidor es otro): el primer render muestra la
  // hora absoluta y, ya montado, la relativa. Nada de dos renders distintos en el mismo HTML.
  React.useEffect(() => {
    setNow(new Date().toISOString());
  }, []);

  async function send(
    method: "PATCH" | "POST",
    body?: unknown,
    url = "/api/admin/settings/notifications",
  ) {
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
    setToast(null);

    try {
      const { ok, payload } = await send("PATCH", {
        chatId: next.chatId === undefined ? trimmedChatId : next.chatId,
        ...(next.enabled === undefined ? {} : { enabled: next.enabled }),
        ...(next.eventsEnabled === undefined ? {} : { eventsEnabled: next.eventsEnabled }),
        refundAlertThreshold: Number(refundThreshold.replace(",", ".")) || 0,
      });

      if (!ok || !payload?.data) {
        setToast({ tone: "error", message: payload?.error?.message ?? "No se pudo guardar." });
        return;
      }

      setSettings(payload.data);
      setChatId(payload.data.chatId ?? "");
      setToast({ tone: "success", message: "Guardado" });
    } catch {
      setToast({ tone: "error", message: "No se pudo guardar: revisá la conexión." });
    } finally {
      setSaving(false);
    }
  }

  /** Un interruptor guarda al toque: sin botón de por medio, el estado que se ve es el que quedó. */
  async function toggleEvent(event: TelegramEvent) {
    const next = settings.eventsEnabled.includes(event)
      ? settings.eventsEnabled.filter((current) => current !== event)
      : [...settings.eventsEnabled, event];

    setSavingEvent(event);
    setSettings({ ...settings, eventsEnabled: next });
    await save({ eventsEnabled: next });
    setSavingEvent(null);
  }

  async function testConnection() {
    setTesting(true);
    setToast(null);

    try {
      const { ok, payload } = await send("POST", undefined, "/api/admin/settings/notifications/test");

      if (!ok) {
        setToast({ tone: "error", message: payload?.error?.message ?? "No se pudo probar la conexión." });
      } else {
        setToast({ tone: "success", message: "Mensaje de prueba enviado. Revisá el grupo." });
      }

      // El resultado de la prueba queda guardado (último envío / último error): se relee para mostrarlo.
      const refreshed = await send("PATCH", { chatId: trimmedChatId });
      if (refreshed.payload?.data) setSettings(refreshed.payload.data);
    } catch {
      setToast({ tone: "error", message: "No se pudo probar la conexión: revisá la red." });
    } finally {
      setTesting(false);
    }
  }

  function focusChatId() {
    document.getElementById(chatInputId)?.focus();
  }

  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_LIMIT);

  return (
    <div className="space-y-6">
      {/* BLOQUE 1 — Estado: lo primero que mira el dueño es si esto está andando. */}
      <section
        aria-label="Estado de las alertas"
        className={`space-y-3 rounded-stitch-lg border border-line-subtle border-l-4 bg-surface-card p-4 ${tone.card}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-st-h3 font-semibold text-ink">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
            {STATUS_LABEL[status]}
          </p>

          {status === "conectado" || status === "desconectado" ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={testing}
              onClick={() => void testConnection()}
            >
              {testing ? "Probando…" : "Probar conexión"}
            </Button>
          ) : (
            <Button type="button" className="min-h-11" onClick={focusChatId}>
              Configurar
            </Button>
          )}
        </div>

        <dl className="grid gap-2 text-st-body sm:grid-cols-3">
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Chat ID
            </dt>
            <dd className="font-mono tabular-nums text-ink">{settings.chatId ?? "—"}</dd>
          </div>
          {botUsername ? (
            <div>
              <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">Bot</dt>
              <dd className="font-mono text-ink">@{botUsername}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Último envío
            </dt>
            <dd className="font-mono tabular-nums text-ink">
              {settings.lastSentAt
                ? formatShiftDateTime(settings.lastSentAt, { timezone, locale })
                : "Todavía no se mandó nada"}
            </dd>
          </div>
        </dl>

        {settings.lastError ? (
          <p className="text-st-body font-medium text-status-sla-text">
            Último error: {settings.lastError}
          </p>
        ) : null}

        {!tokenConfigured ? (
          <p className="text-st-body text-ink-secondary">
            Falta <span className="font-mono">TELEGRAM_BOT_TOKEN</span> en el servidor: el bot lo configura
            el administrador del sistema.
          </p>
        ) : null}
      </section>

      {/* BLOQUE 2 — Configuración: a qué grupo salen los avisos. */}
      <section
        aria-label="Grupo de Telegram"
        className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Configuración</h2>

        <Input
          id={chatInputId}
          label="Chat ID"
          value={chatId}
          placeholder="-1001234567890"
          onChange={(event) => setChatId(event.target.value)}
          description="Obtenelo agregando @RawDataBot al grupo."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={saving || trimmedChatId === "" || !hasChanges}
            onClick={() => void save({ enabled: true })}
          >
            {saving ? "Guardando…" : "Guardar y activar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={saving || !settings.enabled}
            onClick={() => void save({ enabled: false })}
          >
            Desactivar alertas
          </Button>
        </div>
      </section>

      {/* BLOQUE 3 — Eventos: qué se avisa. */}
      <section
        aria-label="Eventos que se avisan"
        className="rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Eventos a avisar</h2>
        <p className="mt-1 text-st-body text-ink-secondary">
          Todo queda registrado en el sistema; acá elegís qué se reenvía al grupo.
        </p>

        <ul className="mt-3">
          {TELEGRAM_EVENTS.map((event) => {
            const active = settings.eventsEnabled.includes(event);

            return (
              <li
                key={event}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-hidden="true" className="text-st-h3">
                    {EVENT_ICONS[event]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-st-body font-semibold text-ink">
                      {TELEGRAM_EVENT_LABELS[event]}
                    </p>
                    <p className="text-st-body text-ink-secondary">
                      {TELEGRAM_EVENT_DESCRIPTIONS[event]}
                    </p>

                    {/* El umbral solo tiene sentido si el aviso está prendido. */}
                    {event === "refund_over_threshold" && active ? (
                      <div className="mt-2 max-w-xs">
                        <Input
                          label={`Devolución mayor a (${currency.symbol})`}
                          value={refundThreshold}
                          inputMode="decimal"
                          onChange={(input) => setRefundThreshold(input.target.value)}
                          onBlur={() => void save({})}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <Toggle
                  checked={active}
                  tone="amber"
                  saving={savingEvent === event}
                  label={`Avisar: ${TELEGRAM_EVENT_LABELS[event]}`}
                  onChange={() => void toggleEvent(event)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* BLOQUE 4 — Historial: la prueba de que los avisos salen. */}
      <section
        aria-label="Historial de envíos"
        className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
      >
        <h2 className="text-st-h2 text-ink">Historial</h2>

        {history.length === 0 ? (
          <p className="text-st-body text-ink-secondary">
            Todavía no salió ningún aviso. Cuando se cierre una caja, aparece acá.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {visibleHistory.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-st-body text-ink-secondary">
                    <span className="font-mono tabular-nums text-ink-muted">
                      {now ? formatRelativeTime(row.at, now) : formatShiftDateTime(row.at, { timezone, locale })}
                    </span>{" "}
                    — {row.label}
                    {row.locationName ? ` · ${row.locationName}` : ""}
                  </span>
                  <span className="text-st-body">
                    {row.ok ? (
                      <span className="text-status-ready-text">✅ Enviado</span>
                    ) : (
                      <span className="text-status-sla-text">❌ No salió</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {history.length > HISTORY_LIMIT ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setShowAllHistory((current) => !current)}
              >
                {showAllHistory ? "Ver menos" : "Ver todos"}
              </Button>
            ) : null}
          </>
        )}
      </section>

      {toast ? (
        <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </div>
  );
}
