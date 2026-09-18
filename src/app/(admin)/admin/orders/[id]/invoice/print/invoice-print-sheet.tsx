import type { ReactNode } from "react";

import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from "@/modules/orders/domain/order.types";
import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { formatSheetAmount } from "@/shared/lib/shift-sheet-format";

/**
 * Factura simple (2026-09-18) — la hoja de **80 mm** (impresora térmica de mostrador).
 *
 * **No es una factura fiscal.** Es el papel que el cliente se lleva y se imprime en el rollo del local, así
 * que: una sola columna, ancho fijo de 80 mm (302 px a 96 dpi), negro sobre blanco, separadores punteados y
 * **mono para los números** para que las columnas no bailen. La decisión del owner (2026-09-18) es 80 mm y
 * no A4: es la impresora que hay en el mostrador.
 *
 * Tres reglas:
 *
 * 1. **Lo que falta no se imprime.** Sin logo queda el isotipo; sin isotipo, el nombre. Sin RUC del cliente
 *    no hay esa línea. No se inventa una dirección ni un teléfono.
 * 2. **El logo es el isotipo** (`logoMarkUrl`) y no el logo completo: la térmica imprime en 1 bit y un logo
 *    con color sale manchado.
 * 3. **Los montos son los de la factura** (congelados al emitir) y los cobros son los **reales** del pedido:
 *    efectivo con su vuelto, tarjeta, transferencia o el detalle de un cobro partido, con la propina aparte.
 */

export type InvoicePrintItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
  modifiers?: string[];
};

export type InvoicePrintPayment = {
  method: PaymentMethodType;
  amount: number;
  currency: string | null;
  changeAmount: number;
  tip: number;
};

type InvoicePrintSheetProps = {
  invoice: InvoiceRecord;
  orderNumber: string;
  items: InvoicePrintItem[];
  payments: InvoicePrintPayment[];
  /** El isotipo del negocio. `null` = solo el nombre (la térmica no imprime bien un logo con color). */
  logoUrl: string | null;
  /** WhatsApp del cliente, del pedido (la factura no lo congela). */
  customerWhatsapp?: string | null;
  /** Moneda del negocio: lo que no está en ella se imprime con su código. */
  businessCurrencyCode: string;
  currency: CurrencyFormat;
};

/** Ancho de la hoja: 80 mm a 96 dpi. */
const SHEET_WIDTH = "80mm";

function Separator() {
  return <div aria-hidden="true" className="my-2 border-t border-dashed border-black/40" />;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-st-overline font-bold uppercase tracking-widest opacity-70">{children}</p>
  );
}

export default function InvoicePrintSheet({
  invoice,
  orderNumber,
  items,
  payments,
  logoUrl,
  customerWhatsapp = null,
  businessCurrencyCode,
  currency,
}: InvoicePrintSheetProps) {
  const moneyInBusiness = (amount: number) => formatCurrency(amount, currency);
  const moneyIn = (amount: number, code: string | null) =>
    formatSheetAmount(amount, code ?? businessCurrencyCode, {
      currencyCode: businessCurrencyCode,
      currencySymbol: currency.symbol,
      locale: currency.locale,
    });

  const branchLines = [
    invoice.branchAddressLine,
    invoice.branchCity,
    invoice.branchPhone ? `Tel: ${invoice.branchPhone}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  const hasBranch = Boolean(invoice.branchName || branchLines.length > 0);
  const isSingleCash = payments.length === 1 && payments[0].method === "cash";
  const change = isSingleCash ? payments[0].changeAmount : 0;

  return (
    <article
      aria-label="Factura simple"
      style={{ width: SHEET_WIDTH }}
      className="mx-auto bg-white px-2 py-3 text-black print:w-auto print:px-0 print:py-0"
    >
      <header className="text-center">
        {logoUrl ? (
          // El isotipo, centrado y chico: en 1 bit un logo grande con color sale manchado.
          <img src={logoUrl} alt="" className="mx-auto h-10 w-auto max-w-[40mm] object-contain" />
        ) : null}
        <p className="text-st-body font-bold">{invoice.businessLegalName ?? invoice.businessName}</p>
        {invoice.businessLegalName ? <p className="text-st-caption">{invoice.businessName}</p> : null}
        {invoice.businessTaxId ? (
          <p className="text-st-caption">RUC: {invoice.businessTaxId}</p>
        ) : null}
        {invoice.businessAddress ? (
          <p className="text-st-caption">{invoice.businessAddress}</p>
        ) : null}
        {invoice.businessPhone ? (
          <p className="text-st-caption">Tel: {invoice.businessPhone}</p>
        ) : null}
      </header>

      <Separator />

      <section className="text-center">
        <h1 className="text-st-body font-bold uppercase tracking-widest">Factura simple</h1>
        <p className="font-mono text-st-caption tabular-nums">No. {invoice.number}</p>
        <p className="font-mono text-st-caption tabular-nums">
          {new Date(invoice.issuedAt).toLocaleString(currency.locale, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </section>

      <Separator />

      <section>
        <SectionLabel>Cliente</SectionLabel>
        <p className="text-st-caption font-semibold">{invoice.customerName}</p>
        {customerWhatsapp ? <p className="text-st-caption">{customerWhatsapp}</p> : null}
        {invoice.customerTaxId ? (
          <p className="text-st-caption">RUC: {invoice.customerTaxId}</p>
        ) : null}
        {invoice.customerLegalName ? (
          <p className="text-st-caption">{invoice.customerLegalName}</p>
        ) : null}
      </section>

      {hasBranch ? (
        <>
          <Separator />
          <section>
            <SectionLabel>Sucursal de retiro</SectionLabel>
            {invoice.branchName ? (
              <p className="text-st-caption font-semibold">{invoice.branchName}</p>
            ) : null}
            {branchLines.map((line) => (
              <p key={line} className="text-st-caption">
                {line}
              </p>
            ))}
            {invoice.branchWhatsapp ? (
              <p className="text-st-caption">WhatsApp: {invoice.branchWhatsapp}</p>
            ) : null}
            {invoice.branchMapsUrl ? (
              <p className="break-all text-st-overline opacity-70">{invoice.branchMapsUrl}</p>
            ) : null}
          </section>
        </>
      ) : null}

      <Separator />

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-st-overline font-bold uppercase tracking-widest opacity-70">
            <th className="w-10 pb-1 pr-1 text-left">Cant</th>
            <th className="pb-1 text-left">Descripción</th>
            <th className="w-20 pb-1 text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="align-top">
              <td className="py-0.5 font-mono text-st-caption tabular-nums">{item.quantity}</td>
              <td className="py-0.5 text-st-caption">
                <p>{item.name}</p>
                {item.modifiers?.length ? (
                  <p className="opacity-70">{item.modifiers.join(" · ")}</p>
                ) : null}
                {item.notes ? <p className="opacity-70">{item.notes}</p> : null}
              </td>
              <td className="py-0.5 text-right font-mono text-st-caption tabular-nums">
                {moneyInBusiness(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Separator />

      <dl className="text-st-caption">
        <div className="flex items-baseline justify-between">
          <dt>Subtotal</dt>
          <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt>Empaque</dt>
          <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.packagingAmount)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt>Descuento</dt>
          <dd className="font-mono tabular-nums">-{moneyInBusiness(invoice.discount)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt>Propina</dt>
          <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.tipAmount)}</dd>
        </div>
      </dl>

      <div className="mt-1 flex items-baseline justify-between border-t border-black pt-1">
        <span className="text-st-body font-bold uppercase">Total</span>
        <span className="font-mono text-st-body font-bold tabular-nums">
          {moneyInBusiness(invoice.total)}
        </span>
      </div>

      <Separator />

      <section className="text-st-caption">
        <SectionLabel>Pago</SectionLabel>
        {payments.length === 0 ? (
          <p>Sin cobros registrados.</p>
        ) : (
          <ul>
            {payments.map((payment, index) => (
              <li key={`${payment.method}-${index}`} className="flex items-baseline justify-between">
                <span>{PAYMENT_METHOD_TYPE_LABELS[payment.method]}</span>
                <span className="font-mono tabular-nums">
                  {moneyIn(payment.amount, payment.currency)}
                </span>
              </li>
            ))}
            {isSingleCash && change > 0 ? (
              <li className="flex items-baseline justify-between">
                <span>Vuelto</span>
                <span className="font-mono tabular-nums">
                  {moneyIn(change, businessCurrencyCode)}
                </span>
              </li>
            ) : null}
            {invoice.tipAmount > 0 ? (
              <li className="flex items-baseline justify-between">
                <span>Propina</span>
                <span className="font-mono tabular-nums">{moneyInBusiness(invoice.tipAmount)}</span>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <Separator />

      <footer className="text-center text-st-overline">
        <p className="font-bold">Documento no fiscal.</p>
        <p className="opacity-70">
          Pedido <span className="font-mono tabular-nums">{orderNumber}</span>
          {invoice.branchName ? ` · ${invoice.branchName}` : ""}
        </p>
        <p className="opacity-70">Gracias por su compra.</p>
      </footer>
    </article>
  );
}
