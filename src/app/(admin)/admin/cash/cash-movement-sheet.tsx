"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

import AdminEditSheet from "../_components/admin-edit-sheet";

/**
 * Fase 5 del rediseño de Caja (2026-09-23) — registrar un movimiento de caja desde una **hoja**, con una fila
 * por moneda.
 *
 * Qué cambia respecto de la Fase 2: el alta pedía **una** moneda a la vez. En un local que trabaja córdobas y
 * dólares, sacar plata de los dos cajones eran dos altas y dos motivos escritos. Ahora el motivo (y el tipo y
 * la categoría) se escriben una vez y cada moneda con monto se registra como su propio movimiento.
 *
 * Tres reglas:
 *
 * 1. **Una fila con monto = un movimiento**: el servidor guarda un movimiento por moneda (su modelo tiene una
 *    moneda por fila), así que la hoja manda una llamada por fila con monto y **no** inventa una fila nueva.
 * 2. **Un movimiento sin motivo no se registra** (misma regla que el servidor): el botón no se habilita.
 * 3. **Si una de las dos falla, se dice cuál**: dos altas no son una transacción; lo que entró quedó
 *    registrado y el cajero tiene que saberlo para no volver a mover la misma plata.
 */

const KIND_OPTIONS = [
  { value: "withdrawal", label: "Retiro (sale del cajón)" },
  { value: "deposit", label: "Ingreso (entra al cajón)" },
];

const CATEGORY_OPTIONS = [
  { value: "supplier", label: "Proveedor" },
  { value: "change_fund", label: "Cambio" },
  { value: "vault", label: "Bóveda" },
  { value: "expense", label: "Gasto" },
  { value: "other", label: "Otro" },
];

export default function CashMovementSheet({
  open,
  shiftId,
  currencies,
  onRegistered,
  onClose,
}: {
  open: boolean;
  shiftId: string;
  /** Las monedas que el local trabaja (la config del conteo): una fila por cada una. */
  currencies: string[];
  onRegistered: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = React.useState("withdrawal");
  const [category, setCategory] = React.useState("supplier");
  const [reason, setReason] = React.useState("");
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Al cerrar se limpia: la hoja no puede quedar con el monto de la vez pasada (ni el motivo).
  React.useEffect(() => {
    if (open) return;

    setKind("withdrawal");
    setCategory("supplier");
    setReason("");
    setAmounts({});
    setError(null);
    setFieldErrors({});
  }, [open]);

  const filled = currencies.filter((code) => Number(amounts[code]) > 0);
  const canSubmit = filled.length > 0 && reason.trim().length > 0 && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const registered: string[] = [];
    const failed: { currency: string; message: string }[] = [];

    for (const code of filled) {
      try {
        const response = await fetch(`/api/admin/cash/shifts/${shiftId}/movements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            category,
            amount: Number(amounts[code]),
            currency: code,
            reason,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string; fields?: Record<string, string> };
        };

        if (!response.ok) {
          failed.push({
            currency: code,
            message: body.error?.message ?? "No se pudo registrar el movimiento.",
          });
          setFieldErrors((current) => ({ ...current, ...(body.error?.fields ?? {}) }));
          continue;
        }

        registered.push(code);
      } catch {
        failed.push({ currency: code, message: "No se pudo registrar: revisá la conexión." });
      }
    }

    if (registered.length > 0) {
      // El historial sale del servidor: se refresca con lo que quedó guardado, no con lo que se creyó mandar.
      onRegistered();
      setAmounts((current) => {
        const next = { ...current };
        for (const code of registered) next[code] = "";
        return next;
      });
    }

    if (failed.length === 0) {
      setReason("");
      setError(null);
      onClose();
      setBusy(false);
      return;
    }

    const detail = failed.map((failure) => `${failure.currency}: ${failure.message}`).join(" · ");
    setError(
      registered.length > 0
        ? `Se registró ${registered.join(", ")}; no se registró ${detail}`
        : `No se registró ${detail}`,
    );
    setBusy(false);
  }

  return (
    <AdminEditSheet
      open={open}
      onClose={onClose}
      kicker="Caja"
      title="Movimiento de caja"
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="min-h-11"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? "Registrando…" : "Registrar movimiento"}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-st-body text-ink-secondary">
          El mismo motivo vale para todas las monedas. Dejá en blanco la que no movés: una fila con monto se
          registra como el movimiento de esa moneda.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Tipo"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            options={KIND_OPTIONS}
          />
          <Select
            label="Para qué"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={CATEGORY_OPTIONS}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {currencies.map((code) => (
            <Input
              key={code}
              label={`Monto en ${code}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amounts[code] ?? ""}
              error={fieldErrors.amount}
              onChange={(event) =>
                setAmounts((current) => ({ ...current, [code]: event.target.value }))
              }
            />
          ))}
        </div>

        <Textarea
          label="Por qué"
          value={reason}
          error={fieldErrors.reason}
          onChange={(event) => setReason(event.target.value)}
        />

        {error ? (
          <p role="alert" className="text-st-body font-medium text-status-sla-text">
            {error}
          </p>
        ) : null}
      </div>
    </AdminEditSheet>
  );
}
