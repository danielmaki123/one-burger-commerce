"use client";

import * as React from "react";

import { PAYMENT_METHOD_TYPE_LABELS } from "@/modules/orders/domain/order.types";
import type { PosDraftLine } from "@/modules/pos/domain/pos-draft";
import { posDraftTotals } from "@/modules/pos/domain/pos-draft";
import { manualDiscountAmount } from "@/modules/orders/domain/sale-discount";
import { describeCouponLabel } from "@/shared/lib/coupon-label";
import type { CurrencyFormat } from "@/shared/lib/format-currency";

import type { AppliedManualDiscount } from "../pos-discount-panel";
import { buildPosFiscalPayload, type PosFiscalDraft } from "../pos-fiscal-payload";
import type { PosPaymentDraft, PosSaleSummary } from "../pos-types";

/**
 * El estado y las llamadas del **cobro** de la venta de mostrador: cupón, descuento manual, filas de cobro,
 * validación de pantalla, idempotencia del intento y el alta contra el servidor.
 *
 * Sale de `pos-client.tsx` por la misma razón que el resto de la Fase 1: esa pantalla es deuda con techo
 * congelado y el cobro es una responsabilidad con su propia API (lo que el cajero completa, lo que viaja al
 * servidor y lo que se muestra después). La pantalla queda como orquestación.
 *
 * **Nada de esto decide plata**: el descuento del cupón lo cotiza el servidor, el descuento manual lo
 * calcula el dominio (`manualDiscountAmount`) y el total que se cobra es el que devuelve el servidor. Acá se
 * guarda lo que el cajero armó y se arma el cuerpo del `POST`.
 */

export type PosSaleAttempt = {
  attemptKey: string;
  renewAttemptKey: () => void;
  restoreAttemptKey: (key: string) => void;
};

/** Lo que se guarda al dejar la venta en espera: las líneas, el cobro armado y la clave del intento. */
export type PosHoldPayload = {
  lines: PosDraftLine[];
  payments: { method: string; currency: string; amount: string; reference?: string }[];
  attemptKey: string;
};

export type UsePosSaleParams = {
  locationId: string;
  /** Fase 6 — la terminal que firma el cobro (`Payment.shiftId`). */
  terminalId: string | null;
  currencyCode: string;
  currency: CurrencyFormat;
  /** Punto 4 — la factura con RUC que el cajero cargó (la valida el dominio de la pantalla). */
  fiscal: PosFiscalDraft;
  /** El estado del cliente: viaja en el cobro y en el recibo. */
  customer: { name: string; whatsapp: string; email: string };
  /** El intento (idempotencia) que administra `usePosDraft`: acá solo se usa y se renueva. */
  attempt: PosSaleAttempt;
  /** El borrador del que salen las líneas y los totales (la fuente es el dominio, no esta hook). */
  draft: { locationId: string; lines: PosDraftLine[] };
  /** El desmontaje del mostrador después de cobrar (borrador, cliente, intento). */
  onSaleCharged: () => void;
  /** Deja la venta a un lado (tareas 9.4/9.5) con lo que el cajero armó. */
  onHold: (payload: PosHoldPayload) => void;
};

export function usePosSale({
  locationId,
  terminalId,
  currencyCode,
  currency,
  fiscal,
  customer,
  attempt,
  draft,
  onSaleCharged,
  onHold,
}: UsePosSaleParams) {
  /**
   * El cupón que el cliente trajo, **cotizado por el servidor**. Se guarda con la **firma de la venta**
   * sobre la que se cotizó: un código aplicado a una venta que después cambió vale para esa venta, no para
   * esta (el descuento se calculó sobre lo que había). Con la firma, la cotización vencida se descarta sola.
   */
  const [coupon, setCoupon] = React.useState<{
    code: string;
    label: string;
    discount: number;
    cartSignature: string;
  } | null>(null);
  const [couponBusy, setCouponBusy] = React.useState(false);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [manualDiscount, setManualDiscount] = React.useState<AppliedManualDiscount | null>(null);
  const [payments, setPayments] = React.useState<PosPaymentDraft[]>(() => [
    { id: "pay_1", method: "cash", currency: currencyCode, amount: "" },
  ]);
  const [charging, setCharging] = React.useState(false);
  const [saleError, setSaleError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [lastSale, setLastSale] = React.useState<PosSaleSummary | null>(null);

  /**
   * El monto del **descuento manual** autorizado, resuelto por el dominio (`manualDiscountAmount`): la
   * pantalla no lo recalcula y el cobro manda la forma y el motivo, no el número.
   */
  const manualDiscountValue = React.useMemo(() => {
    if (manualDiscount === null) return 0;

    const resolved = manualDiscountAmount({
      discount: manualDiscount,
      subtotal: posDraftTotals(draft).subtotal,
    });

    return resolved.ok ? resolved.amount : 0;
  }, [draft, manualDiscount]);

  /**
   * La firma de la venta: si cambia, el cupón cotizado ya no vale para lo que hay en el mostrador. Una
   * cotización vencida **no se descuenta** del total: se cotizó sobre lo que había.
   */
  const cartSignature = draft.lines.map((line) => `${line.productId}x${line.quantity}`).join("|");
  const appliedCoupon = coupon !== null && coupon.cartSignature === cartSignature ? coupon : null;

  /**
   * El total que se muestra sale de la **misma fórmula** que el servidor (`posDraftTotals`) con los
   * descuentos que ya están aplicados: el cupón cotizado y el descuento manual autorizado. El cálculo vive
   * acá y no en la pantalla porque el cupón y el descuento también viven acá: una segunda suma en la
   * pantalla es exactamente lo que el repo prohíbe.
   */
  const totals = posDraftTotals(draft, (appliedCoupon?.discount ?? 0) + manualDiscountValue);

  const getLines = React.useCallback(() => draft.lines, [draft.lines]);

  /**
   * Desmonta la venta en curso: el cobro armado, el cupón y el descuento se van con el cliente que se fue.
   *
   * **No toca la confirmación del último cobro** (`lastSale`): ese estado se escribe al cobrar y el recibo y
   * los tickets salen de ahí. Si esta limpieza lo borrara, el cajero perdería el comprobante de la venta que
   * acaba de cobrar (y el orden de los `setState` en el mismo tick definiría la suerte del recibo).
   */
  const resetSale = React.useCallback(() => {
    setPayments([{ id: "pay_1", method: "cash", currency: currencyCode, amount: "" }]);
    setCoupon(null);
    setCouponError(null);
    setManualDiscount(null);
    setSaleError(null);
    setFieldErrors({});
  }, [currencyCode]);

  /** Arranca una venta nueva **y** suelta la confirmación anterior: es lo que hace cambiar de local. */
  const startNewSale = React.useCallback(() => {
    setLastSale(null);
    resetSale();
  }, [resetSale]);

  /**
   * Pide al servidor cuánto descuenta el código sobre **esta** venta. El descuento lo calcula el servidor
   * con la misma fórmula que el alta y sin consumir el cupón; acá solo se muestra.
   */
  const applyCoupon = React.useCallback(
    async (code: string) => {
      setCouponBusy(true);
      setCouponError(null);

      const signature = getLines()
        .map((line) => `${line.productId}x${line.quantity}`)
        .join("|");

      try {
        const response = await fetch("/api/admin/pos/coupon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            code,
            lines: getLines().map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          }),
        });

        const body = (await response.json()) as {
          data?: {
            coupon: Parameters<typeof describeCouponLabel>[0];
            discount: number;
          };
          error?: { message?: string };
        };

        if (!response.ok || !body.data) {
          setCoupon(null);
          setCouponError(body.error?.message ?? "No se pudo aplicar el código.");
          return;
        }

        setCoupon({
          code: body.data.coupon.code,
          label: describeCouponLabel(body.data.coupon, currency.symbol),
          discount: body.data.discount,
          cartSignature: signature,
        });
      } catch {
        setCouponError("No se pudo aplicar el código: revisá la conexión.");
      } finally {
        setCouponBusy(false);
      }
    },
    [currency.symbol, getLines, locationId],
  );

  const removeCoupon = React.useCallback(() => {
    setCoupon(null);
    setCouponError(null);
  }, []);

  /**
   * Partir el cobro: una fila más con otro medio (efectivo + transferencia, dos tarjetas). El id lleva la
   * hora para que dos filas creadas en el mismo milisegundo no compartan identidad.
   */
  const addPaymentRow = React.useCallback(() => {
    setPayments((current) => [
      ...current,
      {
        id: `pay_${current.length + 1}_${Date.now()}`,
        method: "transfer",
        currency: currencyCode,
        amount: "",
      },
    ]);
  }, [currencyCode]);

  /** Saca una fila del cobro partido. La primera no se saca: es el medio de la venta. */
  const removePaymentRow = React.useCallback((paymentId: string) => {
    setPayments((current) => current.filter((payment) => payment.id !== paymentId));
  }, []);

  /**
   * El cobro: valida lo mínimo en pantalla (lo mismo que valida el servidor), manda **una** operación con su
   * clave de intento y limpia el mostrador. El total que manda lo resuelve el servidor; el del recibo es el
   * que el cajero acaba de ver.
   */
  const charge = React.useCallback(async () => {
    const problems: Record<string, string> = {};
    const lines = getLines();
    const filled = payments.filter((payment) => Number(payment.amount) > 0);
    const fiscalPayload = buildPosFiscalPayload(fiscal);

    if (lines.length === 0) problems.lines = "Agregá al menos un producto.";
    if (customer.name.trim() === "") problems.name = "Escribí el nombre del cliente.";
    if (customer.whatsapp.trim() === "") problems.whatsapp = "Escribí el número del cliente.";
    if (!fiscalPayload.ok) problems[fiscalPayload.field] = fiscalPayload.message;
    if (filled.length === 0) problems.amount = "Escribí con cuánto paga el cliente.";
    else if (filled.length !== payments.length) {
      problems.amount = "Completá el monto de todos los cobros.";
    }

    setFieldErrors(problems);
    setSaleError(null);

    if (Object.keys(problems).length > 0) {
      setSaleError("Revisá los datos marcados.");
      return;
    }

    setCharging(true);
    try {
      const response = await fetch("/api/admin/pos/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          customer: {
            name: customer.name,
            whatsapp: customer.whatsapp,
            email: customer.email.trim() === "" ? null : customer.email,
            // Punto 4: ya validados arriba; sin factura viajan los dos en null.
            taxId: fiscalPayload.ok ? fiscalPayload.taxId : null,
            legalName: fiscalPayload.ok ? fiscalPayload.legalName : null,
          },
          lines,
          payments: filled.map((payment) => ({
            method: payment.method,
            currency: payment.currency,
            amount: Number(payment.amount),
            ...(payment.reference ? { reference: payment.reference } : {}),
          })),
          idempotencyKey: attempt.attemptKey,
          terminalId,
          couponCode: appliedCoupon?.code ?? null,
          manualDiscount: manualDiscount
            ? {
                kind: manualDiscount.kind,
                value: manualDiscount.value,
                reason: manualDiscount.reason,
              }
            : null,
        }),
      });

      const body = (await response.json()) as {
        data?: PosSaleSummary & {
          payments?: { method: string; amount: number; currency: string | null }[];
        };
        error?: { message?: string; fields?: Record<string, string> };
      };

      if (!response.ok || !body.data) {
        setFieldErrors(body.error?.fields ?? {});
        setSaleError(body.error?.message ?? "No se pudo cobrar la venta.");
        return;
      }

      setLastSale({
        ...body.data,
        // La hora del cobro queda fija acá: los tickets llevan la hora de la venta, no la de la impresión.
        chargedAt: new Date().toISOString(),
        // El recibo se arma con lo que se acaba de cobrar: el borrador se limpia enseguida.
        receipt: {
          customerName: customer.name,
          lines: lines.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.unitPrice * line.quantity,
          })),
          subtotal: totals.subtotal,
          packagingAmount: totals.packagingAmount,
          payments: (body.data.payments ?? []).map((payment) => ({
            methodLabel:
              PAYMENT_METHOD_TYPE_LABELS[payment.method as keyof typeof PAYMENT_METHOD_TYPE_LABELS],
            amount: payment.amount,
            currency: payment.currency,
          })),
        },
      });

      // La operación se resolvió: la venta que venga es otra y necesita su propia clave.
      resetSale();
      attempt.renewAttemptKey();
      onSaleCharged();
    } catch {
      setSaleError("No se pudo cobrar: revisá la conexión y reintentá.");
    } finally {
      setCharging(false);
    }
  }, [
    appliedCoupon,
    attempt,
    customer,
    fiscal,
    getLines,
    locationId,
    manualDiscount,
    onSaleCharged,
    payments,
    resetSale,
    terminalId,
    totals.packagingAmount,
    totals.subtotal,
  ]);

  /** Deja la venta a un lado con la clave del intento: retomarla sigue siendo la misma operación. */
  const hold = React.useCallback(() => {
    onHold({
      lines: getLines(),
      payments: payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency,
        amount: payment.amount,
        ...(payment.reference ? { reference: payment.reference } : {}),
      })),
      attemptKey: attempt.attemptKey,
    });

    resetSale();
    attempt.renewAttemptKey();
  }, [attempt, getLines, onHold, payments, resetSale]);

  return {
    /** El cupón cotizado y **vigente** (si la venta cambió, es `null`). */
    coupon: appliedCoupon,
    /** `true` cuando hay una cotización que ya no vale porque la venta cambió. */
    couponStale: coupon !== null && appliedCoupon === null,
    couponBusy,
    couponError,
    applyCoupon,
    removeCoupon,
    manualDiscount,
    setManualDiscount,
    /** El total que se muestra y el que va al recibo (misma fórmula que el servidor). */
    totals,
    payments,
    setPayments,
    addPaymentRow,
    removePaymentRow,
    charging,
    saleError,
    fieldErrors,
    setFieldErrors,
    lastSale,
    charge,
    hold,
    resetSale,
    startNewSale,
  };
}
