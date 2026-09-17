"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

/**
 * Bloque 2.3 del roadmap del POS (Fase 2) — registrar un movimiento de caja desde el turno.
 *
 * Se registra **sobre el turno abierto** y el detalle del cierre lo muestra en su historial. El
 * formulario pide lo que el control interno necesita: qué lado va la plata (retiro o ingreso), para
 * qué fue (categoría), cuánto, en qué moneda y **por qué** (obligatorio: un retiro sin motivo no se
 * audita).
 *
 * El monto va siempre positivo: el signo lo da el tipo de movimiento, así el formulario no puede
 * declarar un retiro que en realidad suma.
 */

export type CashMovementOption = { value: string; label: string };

const KIND_OPTIONS: CashMovementOption[] = [
  { value: "withdrawal", label: "Retiro (sale del cajón)" },
  { value: "deposit", label: "Ingreso (entra al cajón)" },
];

const CATEGORY_OPTIONS: CashMovementOption[] = [
  { value: "supplier", label: "Proveedor" },
  { value: "change_fund", label: "Cambio" },
  { value: "vault", label: "Bóveda" },
  { value: "expense", label: "Gasto" },
  { value: "other", label: "Otro" },
];

export default function CashMovementForm({
  shiftId,
  currencies,
  onRegistered,
}: {
  shiftId: string;
  currencies: string[];
  onRegistered: () => void;
}) {
  const [kind, setKind] = React.useState("withdrawal");
  const [category, setCategory] = React.useState("supplier");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState(currencies[0] ?? "NIO");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch(`/api/admin/cash/shifts/${shiftId}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          category,
          amount: Number(amount),
          currency,
          reason,
        }),
      });
      const body: { error?: { message?: string; fields?: Record<string, string> } } =
        await response.json();

      if (!response.ok) {
        setFieldErrors(body.error?.fields ?? {});
        setError(body.error?.message ?? "No se pudo registrar el movimiento.");
        return;
      }

      setDone("Movimiento registrado.");
      setAmount("");
      setReason("");
      onRegistered();
    } catch {
      setError("No se pudo registrar el movimiento: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-st-h3 text-ink">Registrar movimiento</h3>

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
        <Input
          label="Monto"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={amount}
          error={fieldErrors.amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Select
          label="Moneda"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          options={currencies.map((code) => ({ value: code, label: code }))}
        />
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

      {done ? (
        <p role="status" className="text-st-body font-medium text-status-ready-text">
          {done}
        </p>
      ) : null}

      <Button
        type="button"
        className="min-h-11"
        disabled={busy || amount.trim() === "" || reason.trim() === ""}
        onClick={() => void submit()}
      >
        {busy ? "Registrando…" : "Registrar movimiento"}
      </Button>
    </div>
  );
}
