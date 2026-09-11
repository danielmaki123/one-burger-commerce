"use client";

import React, { useId, useState } from "react";

import {
  formatSlotLabel,
  type PickupSlot,
} from "@/modules/business-settings/domain/pickup-slots";

/**
 * Retiro del pedido, programable y **opcional**.
 *
 * Por defecto el pedido es "lo antes posible": el cliente que está en el local y manda
 * la orden no tiene que elegir nada. Programar es una acción aparte, detrás de este
 * control, para quien necesita retirar más tarde.
 *
 * El control colapsado **siempre muestra el estado** ("Lo antes posible · listo 7:35
 * p. m." o la hora programada): esconderlo detrás de un botón genérico dejaría al
 * cliente sin saber cuándo va a estar su comida.
 */
export const ASAP_OPTION_LABEL = "Lo antes posible";

export function PickupScheduleField({
  scheduledTime,
  asapValue,
  options,
  todayHours,
  onSelect,
}: {
  /** `""` = sin programar (lo antes posible). */
  scheduledTime: string;
  /** La hora calculada para "lo antes posible", solo para mostrarla. */
  asapValue: string;
  options: PickupSlot[];
  todayHours: string;
  onSelect: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const isScheduled = scheduledTime !== "";
  const asapLabel = asapValue ? formatSlotLabel(asapValue) : "";

  function select(value: string) {
    onSelect(value);
    setIsOpen(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-brand">
          <ClockIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {isScheduled ? "Retiro programado" : "Retiro"}
          </span>{" "}
          <span className="block truncate text-sm font-semibold text-foreground">
            {isScheduled
              ? formatSlotLabel(scheduledTime)
              : `${ASAP_OPTION_LABEL}${asapLabel ? ` · listo ~${asapLabel}` : ""}`}
          </span>
        </span>
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-[0_18px_36px_-30px_rgba(41,37,36,0.7)]"
        >
          <p className="px-1 text-xs leading-5 text-muted-foreground">
            El local atiende {todayHours}. Si no elegís una hora, preparamos tu pedido
            apenas llega.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <ScheduleOption
              name="pickupTimeOption"
              checked={!isScheduled}
              onSelect={() => select("")}
              title={ASAP_OPTION_LABEL}
              hint={asapLabel ? `listo ~${asapLabel}` : undefined}
            />
            {options.map((option) => (
              <ScheduleOption
                key={option.value}
                name="pickupTimeOption"
                checked={scheduledTime === option.value}
                onSelect={() => select(option.value)}
                title={option.label}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleOption({
  name,
  checked,
  title,
  hint,
  onSelect,
}: {
  name: string;
  checked: boolean;
  title: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <label className="relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-sm transition-colors hover:border-brand/60 has-[:checked]:border-brand has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background">
      {/*
        El input cubre la tarjeta con opacidad 0 en vez de `sr-only`: sigue siendo un
        radio nativo (teclado y lector de pantalla gratis) pero además es clickeable y
        automatizable. Con `sr-only` queda sin caja, así que las herramientas no pueden
        tocarlo y el arnés termina clickeando la etiqueta de costado.
      */}
      <input
        type="radio"
        name={name}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        checked={checked}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card"
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{title}</span>
        {hint ? (
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
