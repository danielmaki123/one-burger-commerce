"use client";

import * as React from "react";
import Link from "next/link";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **cobrar un pedido del menú desde el POS**.
 *
 * Un pedido del menú público se paga al retirar y no tiene ningún cobro: sin cobro **no se puede facturar**
 * (`emit-invoice` corta con 409). Acá el cajero busca el pedido por su número, registra el cobro y el
 * pedido queda facturable desde su detalle.
 *
 * Tres cosas de la pantalla: el monto viene **precargado con el total** (lo que se cobra es el total, salvo
 * que el cliente pague otra cosa), el medio y la moneda se eligen como en cualquier cobro, y cuando el cobro
 * entra la pantalla dice qué hacer después (ir al detalle del pedido a emitir la factura). Los errores del
 * servidor (pedido ya cobrado, cobro que pasa el total, sin permiso) se muestran tal cual.
 */
export default function PosOrderChargePanel({
  currencies,
  currency,
  terminalId,
}: {
  /** Las monedas del POS (la del negocio y el dólar, como en las filas de cobro). */
  currencies: string[];
  /** Cómo se escribe un monto en pantalla. */
  currency: CurrencyFormat;
  /** Fase 6 — la terminal que cobra, para atribuir el cobro a **su** caja. */
  terminalId: string | null;
}) {
  const [number, setNumber] = React.useState("");
  const [order, setOrder] = React.useState<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
  } | null>(null);
  const [method, setMethod] = React.useState("cash");
  const [payCurrency, setPayCurrency] = React.useState(currencies[0] ?? "NIO");
  const [amount, setAmount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [chargedOrder, setChargedOrder] = React.useState<{ id: string; orderNumber: string } | null>(null);

  async function search() {
    setBusy(true);
    setError(null);
    setChargedOrder(null);
    setOrder(null);

    try {
      const response = await fetch(
        `/api/admin/orders?search=${encodeURIComponent(number.trim())}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        data?: { id: string; orderNumber: string; customerName: string; total: number; status: string }[];
        error?: { message?: string };
      };

      if (!response.ok) {
        setError(body.error?.message ?? "No se pudo buscar el pedido.");
        return;
      }

      const rows = body.data ?? [];
      // El número es único: si la búsqueda devuelve uno solo, es ese (aunque el servidor normalice
      // distinto); si devuelve varios, se exige el número exacto para no cobrarle a otro.
      const found =
        rows.length === 1
          ? rows[0]
          : rows.find((row) => row.orderNumber.toLowerCase() === number.trim().toLowerCase());

      if (!found) {
        setError("No encontramos un pedido con ese número.");
        return;
      }

      setOrder(found);
      setAmount(String(found.total));
      setPayCurrency(currencies[0] ?? "NIO");
    } catch {
      setError("No se pudo buscar el pedido: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    if (!order) return;

    setBusy(true);
    setError(null);
    setChargedOrder(null);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          amount: Number(amount),
          currency: payCurrency,
          reference: reference.trim() === "" ? null : reference.trim(),
          terminalId,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok) {
        setError(
          body.error?.fields?.amount ?? body.error?.message ?? "No se pudo registrar el cobro.",
        );
        return;
      }

      setChargedOrder({ id: order.id, orderNumber: order.orderNumber });
      setOrder(null);
      setNumber("");
      setAmount("");
      setReference("");
    } catch {
      setError("No se pudo registrar el cobro: revisá la conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Cobrar un pedido del menú"
      className="space-y-3 rounded-stitch-lg border border-line-subtle bg-surface-card p-4"
    >
      <h2 className="text-st-h2 text-ink">Cobrar un pedido del menú</h2>

      <p className="text-st-body text-ink-secondary">
        El pedido del menú se paga al retirar: buscá su número, registrá el cobro y después la factura se
        emite desde el detalle del pedido.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="Número de pedido"
          value={number}
          disabled={busy}
          placeholder="P-MUDF8E1K"
          onChange={(event) => setNumber(event.target.value)}
          className="sm:max-w-[12rem]"
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || number.trim().length === 0}
          onClick={() => void search()}
        >
          {busy ? "Buscando…" : "Buscar"}
        </Button>
      </div>

      {order ? (
        <div className="space-y-3 rounded-stitch-md border border-line-subtle p-3">
          <p className="text-st-body text-ink-secondary">
            <span className="font-semibold text-ink">{order.orderNumber}</span> · {order.customerName} ·
            total{" "}
            <span className="font-mono tabular-nums text-ink">
              {formatCurrency(order.total, currency)}
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Medio"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              options={[
                { value: "cash", label: "Efectivo" },
                { value: "card", label: "Tarjeta" },
                { value: "transfer", label: "Transferencia" },
                { value: "other", label: "Otro" },
              ]}
            />
            <Select
              label="Moneda"
              value={payCurrency}
              onChange={(event) => setPayCurrency(event.target.value)}
              options={currencies.map((code) => ({ value: code, label: code }))}
            />
            <Input
              label="Monto cobrado"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Input
              label="Referencia (opcional)"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>

          <Button
            type="button"
            className="min-h-11"
            disabled={busy || amount.trim() === ""}
            onClick={() => void register()}
          >
            {busy ? "Registrando…" : "Registrar cobro"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}

      {chargedOrder ? (
        <p role="status" className="text-st-body font-medium text-status-ready-text">
          {chargedOrder.orderNumber} quedó cobrado.{" "}
          <Link href={`/admin/orders/${chargedOrder.id}`} className="underline">
            Abrí el pedido para emitir la factura
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
