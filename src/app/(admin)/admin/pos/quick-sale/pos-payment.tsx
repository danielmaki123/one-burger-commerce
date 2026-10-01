"use client";

import type { MoneyContext } from "@/modules/money/domain/money-context";
import { paidTotalInBaseCurrency } from "@/modules/money/domain/paid-total";
import type { PosPaymentMethodOption } from "@/modules/pos/domain/pos-payment-methods";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";

import PosPaymentRows from "../pos-payment-rows";
import type { PosPaymentDraft } from "../pos-types";
import { OverlineLabel } from "./pos-disclosure";

/**
 * El cobro de la venta normal: medio, moneda (si hay tasa), monto, montos rápidos y **vuelto en vivo**.
 *
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §39) — **los medios salen del catálogo configurado** para este
 * local, no de una constante del código. Es la corrección de la divergencia de `A-85`: el servidor ya resolvía
 * el medio configurado en el `snapshot`, pero la pantalla ofrecía «Efectivo · Tarjeta · Transferencia · Otro»
 * y el cajero nunca veía «Tarjeta BAC» ni «Zelle».
 *
 * Las filas viven en `PosPaymentRows`, el componente **compartido** con el modo *pedido existente* del POS. La
 * duplicación que había acá era justamente lo que dejaba vivir la lista hardcodeada: una sola implementación,
 * un solo lugar donde los medios salen del catálogo del local.
 *
 * El vuelto y los montos rápidos salen de las mismas fórmulas que usa el servidor al registrar el cobro: el
 * número de la pantalla y el del arqueo no pueden discrepar. En un cobro **partido** no hay vuelto (lo dice el
 * resumen) y lo que se muestra es cuánto se lleva cobrado del total.
 */

export default function PosPaymentFields({
  payments,
  setPayments,
  fieldErrors,
  currency,
  total,
  money,
  acceptedCurrencies,
  methodOptions,
  onRemovePayment,
  onAddPayment,
}: {
  payments: PosPaymentDraft[];
  setPayments: React.Dispatch<React.SetStateAction<PosPaymentDraft[]>>;
  /** Los errores por campo que devolvió el servidor (o los de la validación de la pantalla). */
  fieldErrors: Record<string, string>;
  /** El formato de la moneda base, para los montos rápidos. */
  currency: CurrencyFormat;
  /** El total de la venta: es lo que llena el botón «Exacto». */
  total: number;
  /** El contexto monetario vigente, de `money` (`A-85`). */
  money: MoneyContext;
  /**
   * Las monedas que el negocio acepta **hoy**, para ofrecer esas y no una lista fija. Sale de la misma
   * lectura que `money`: ofrecer una moneda y convertir con otra tasa es lo que este cambio evita.
   */
  acceptedCurrencies: string[];
  /**
   * Los medios configurados que **este local** ofrece, resueltos por el servidor (`PaymentMethodConfig` +
   * `PaymentMethodLocation`). Vacío = el local no tiene ninguno y la pantalla lo dice en vez de inventar
   * botones.
   */
  methodOptions: PosPaymentMethodOption[];
  /** Saca una fila del cobro partido (la primera no se saca: es el medio de la venta). */
  onRemovePayment?: (paymentId: string) => void;
  /** Agrega una fila de cobro con otro medio (partir el pago). */
  onAddPayment?: () => void;
}) {
  const currencyCode = money.baseCurrencyCode;

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69c`) — **la suma de un cobro partido, en una sola moneda**.
   *
   * Antes se sumaba `amount` de cada fila **crudo** y se formateaba con el símbolo de la moneda del negocio:
   * con `10 USD + 355 NIO` a tasa 36.5 el ticket decía «Cobrado C$365» sobre un pedido de C$720. La regla la
   * tiene `money`, que es su dueño; el mostrador la **consume**.
   */
  const paidTotal = paidTotalInBaseCurrency({
    payments,
    baseCurrencyCode: currencyCode,
    rates: money.rates,
  });

  return (
    <div className="space-y-2">
      <OverlineLabel>Pago</OverlineLabel>

      <PosPaymentRows
        payments={payments}
        setPayments={setPayments}
        fieldErrors={fieldErrors}
        currencyCode={currencyCode}
        currency={currency}
        total={total}
        acceptedCurrencies={acceptedCurrencies}
        methodOptions={methodOptions}
        onRemovePayment={onRemovePayment ?? (() => {})}
      />

      {payments.length > 1 ? (
        <p className="text-st-body text-ink-secondary">
          Cobrado{" "}
          <span className="font-mono tabular-nums text-ink">{formatCurrency(paidTotal, currency)}</span> de{" "}
          <span className="font-mono tabular-nums">{formatCurrency(total, currency)}</span>. En un cobro partido
          no hay vuelto.
        </p>
      ) : null}

      {/*
        Partir el cobro: el cajero agrega una fila con otro medio (efectivo + transferencia, dos tarjetas). Vive
        debajo de la primera fila y no detrás de un disclosure: es la mecánica del cobro, no una opción de la
        venta, y el cajero tiene que poder verla sin abrir nada (`SCREEN-POS-QUICK-SALE-001` § *Venta normal*).
      */}
      {onAddPayment ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={onAddPayment}>
          Partir el cobro
        </Button>
      ) : null}
    </div>
  );
}

