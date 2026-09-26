"use client";

import * as React from "react";

import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

import type { PosSaleSummary } from "./pos-types";

/**
 * La **confirmación del cobro**: qué venta se cobró, cuánto y con cuánto pagó el cliente.
 *
 * Vive separada del panel de venta porque es otra cosa: no es un control de la venta en curso (esa ya se
 * cobró y el mostrador está limpio) sino el comprobante de lo que acaba de pasar. Es también donde vive el
 * botón del **recibo** (TASK-307) y los dos tickets de papel, que la pantalla le pasa ya armados.
 *
 * El estado de éxito no se distingue solo por color: dice el número de pedido, el monto y si hubo cambio.
 */
export default function PosSaleConfirmation({
  sale,
  currency,
  receiptState,
  onSendReceipt,
  tickets,
}: {
  sale: PosSaleSummary;
  currency: CurrencyFormat;
  receiptState: "idle" | "busy" | "done" | "error";
  onSendReceipt: () => void;
  /** Los dos papeles de la venta (cocina y cliente), ya armados por la pantalla. */
  tickets: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-stitch-lg border border-status-ready-border bg-status-ready-bg px-3 py-2 text-st-body text-status-ready-text"
    >
      Venta <span className="font-mono">{sale.orderNumber}</span> cobrada por{" "}
      <span className="font-mono tabular-nums">{formatCurrency(sale.total, currency)}</span>
      {sale.change !== null && sale.change > 0
        ? ` · Cambio ${formatCurrency(sale.change, currency)}`
        : " · Sin cambio"}

      {/*
        Tarea 11 del brief (2026-09-17): el reintento de un cobro que sí llegó al servidor. Se dice con todas
        las letras porque lo que viene después es volver a cobrar.
      */}
      {sale.reused ? (
        <p className="mt-1 font-semibold">
          Esa venta ya estaba registrada con esta clave: no se cobró de nuevo.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={receiptState === "busy"}
          onClick={onSendReceipt}
        >
          {receiptState === "busy" ? "Generando…" : "Enviar recibo"}
        </Button>

        {receiptState === "done" ? (
          <span className="text-st-body">Recibo listo para enviar o imprimir.</span>
        ) : null}
        {receiptState === "error" ? (
          <span className="text-st-body font-medium text-status-sla-text">
            No se pudo generar el recibo en este dispositivo.
          </span>
        ) : null}

        {tickets}
      </div>
    </div>
  );
}
