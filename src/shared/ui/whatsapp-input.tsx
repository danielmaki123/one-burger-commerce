"use client";

import * as React from "react";

import {
  WHATSAPP_OTHER_PREFIX_VALUE,
  WHATSAPP_PREFIX_OPTIONS,
  buildWhatsappValue,
  findWhatsappPrefixOption,
  parseWhatsappValue,
  sanitizeWhatsappDigits,
  sanitizeWhatsappPrefix,
} from "@/shared/lib/whatsapp-input-value";

type WhatsAppInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  label?: string;
  helpText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /**
   * Prefijo que se muestra sin número. Sale del teléfono del negocio (T5) y llega
   * `null` cuando el negocio todavía no lo cargó: ahí no se asume ningún país.
   */
  defaultPrefix?: string | null;
};

const DEFAULT_HELP_TEXT = "Elegí el prefijo internacional de tu número.";

export function WhatsAppInput({
  value,
  onChange,
  id,
  name,
  label = "WhatsApp",
  helpText = DEFAULT_HELP_TEXT,
  error,
  disabled = false,
  required = false,
  className = "",
  defaultPrefix = null,
}: WhatsAppInputProps) {
  const initial = React.useMemo(
    () => parseWhatsappValue(value, defaultPrefix ?? ""),
    [value, defaultPrefix],
  );
  // Sin país conocido, el select arranca en "Otro" con el prefijo manual vacío: es lo
  // honesto (no sabemos de dónde es el negocio) y el cliente escribe el suyo.
  const startsWithOther = initial.isOtherPrefix || !initial.prefix;
  const [selectedPrefix, setSelectedPrefix] = React.useState(
    startsWithOther ? WHATSAPP_OTHER_PREFIX_VALUE : initial.prefix,
  );
  const [manualPrefix, setManualPrefix] = React.useState(
    startsWithOther ? initial.prefix : "+",
  );
  const [localNumber, setLocalNumber] = React.useState(initial.localNumber);

  React.useEffect(() => {
    if (!value) return;
    const parsed = parseWhatsappValue(value, defaultPrefix ?? "");
    const isOther = parsed.isOtherPrefix || !parsed.prefix;
    setSelectedPrefix(isOther ? WHATSAPP_OTHER_PREFIX_VALUE : parsed.prefix);
    setManualPrefix(isOther ? parsed.prefix : "+");
    setLocalNumber(parsed.localNumber);
  }, [value, defaultPrefix]);

  const effectivePrefix =
    selectedPrefix === WHATSAPP_OTHER_PREFIX_VALUE ? manualPrefix : selectedPrefix;
  const activeOption = findWhatsappPrefixOption(effectivePrefix);
  const placeholder = activeOption?.placeholder ?? "Número";
  const inputId = id ?? name ?? "customerWhatsapp";

  function emit(nextPrefix: string, nextLocalNumber: string) {
    onChange(buildWhatsappValue(nextPrefix, nextLocalNumber));
  }

  function handlePrefixChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setSelectedPrefix(next);
    const nextPrefix = next === WHATSAPP_OTHER_PREFIX_VALUE ? manualPrefix : next;
    emit(nextPrefix, localNumber);
  }

  function handleManualPrefixChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = sanitizeWhatsappPrefix(event.target.value);
    setManualPrefix(next);
    emit(next, localNumber);
  }

  function handleLocalNumberChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = sanitizeWhatsappDigits(event.target.value);
    setLocalNumber(next);
    emit(effectivePrefix, next);
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="grid grid-cols-[96px_1fr] gap-2 sm:grid-cols-[104px_1fr]">
        <select
          aria-label="Prefijo WhatsApp"
          value={selectedPrefix}
          onChange={handlePrefixChange}
          disabled={disabled}
          className="h-11 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {WHATSAPP_PREFIX_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={WHATSAPP_OTHER_PREFIX_VALUE}>Otro</option>
        </select>
        <input
          id={inputId}
          name={name}
          value={localNumber}
          onChange={handleLocalNumberChange}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="tel"
          disabled={disabled}
          required={required}
          className="flex h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      {selectedPrefix === WHATSAPP_OTHER_PREFIX_VALUE ? (
        <div className="grid grid-cols-[96px_1fr] gap-2 sm:grid-cols-[104px_1fr]">
          <input
            aria-label="Prefijo manual"
            value={manualPrefix}
            onChange={handleManualPrefixChange}
            placeholder="+593"
            inputMode="numeric"
            disabled={disabled}
            className="h-11 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="self-center text-xs text-muted-foreground">Escribí solo el prefijo internacional.</p>
        </div>
      ) : null}
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
    </div>
  );
}
