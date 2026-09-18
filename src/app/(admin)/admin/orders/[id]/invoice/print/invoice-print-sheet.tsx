import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from "@/modules/orders/domain/order.types";
import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { formatSheetAmount } from "@/shared/lib/shift-sheet-format";

/**
 * Factura simple (2026-09-18) — la **hoja A4** del documento (rediseño).
 *
 * **No es una factura fiscal.** Es el papel que el cliente se lleva y por eso es un documento, no una
 * pantalla: fondo blanco siempre (aunque el panel sea oscuro), nada de controles, y todo lo que se imprime
 * sale de datos que ya existen —el negocio, la sucursal congelada en la factura, el cliente y el pedido—.
 *
 * Tres reglas:
 *
 * 1. **Lo que falta no se imprime.** Sin logo queda el isotipo; sin isotipo, el nombre. Sin RUC no hay
 *    línea de RUC. No se inventa una dirección ni un teléfono.
 * 2. **Los montos son los de la factura** (congelados al emitir) y los cobros son los reales del pedido:
 *    efectivo con su vuelto, tarjeta, transferencia o el detalle de un cobro partido.
 * 3. **Los números en mono con `tabular-nums`**, como pide el sistema, para que la columna de importes no
 *    baile al imprimir.
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
  /** El logo del negocio, o el isotipo si no hay logo completo. `null` = solo el nombre. */
  logoUrl: string | null;
  /** Moneda del negocio: lo que no está en ella se imprime con su código (no con el símbolo local). */
  businessCurrencyCode: string;
  currency: CurrencyFormat;
};

export default function InvoicePrintSheet({
  invoice,
  orderNumber,
  items,
  payments,
  logoUrl,
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
    invoice.branchPhone ? `Tel. ${invoice.branchPhone}` : null,
    invoice.branchWhatsapp ? `WhatsApp ${invoice.branchWhatsapp}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  const hasBranch = Boolean(invoice.branchName || branchLines.length > 0);
  const isSingleCash = payments.length === 1 && payments[0].method === "cash";
  const change = isSingleCash ? payments[0].changeAmount : 0;

  return (
    <article
      aria-label="Factura simple"
      className="mx-auto w-full max-w-[210mm] bg-white p-6 text-black sm:p-10 print:max-w-none print:p-0"
    >
      <header className="flex items-start justify-between gap-6 border-b border-black/20 pb-5">
        <div className="flex min-w-0 items-center gap-4">
          {logoUrl ? (
            // El logo se resuelve desde la configuración y se imprime tal cual (sin fondo ni filtros).
            // Es una imagen externa del negocio: `<img>` y no `next/image` (que pediría optimizarla).
            <img src={logoUrl} alt="" className="h-16 w-auto max-w-[52mm] object-contain" />
          ) : (
            <p className="text-xl font-bold uppercase tracking-wide">{invoice.businessName}</p>
          )}
        </div>

        <div className="min-w-0 text-right text-xs leading-relaxed">
          <p className="text-sm font-bold">{invoice.businessLegalName ?? invoice.businessName}</p>
          {invoice.businessLegalName ? <p>{invoice.businessName}</p> : null}
          {invoice.businessTaxId ? <p>RUC {invoice.businessTaxId}</p> : null}
          {invoice.businessAddress ? <p>{invoice.businessAddress}</p> : null}
          {invoice.businessPhone ? <p>{invoice.businessPhone}</p> : null}
        </div>
      </header>

      <section className="flex flex-wrap items-end justify-between gap-3 py-4">
        <h1 className="text-lg font-bold uppercase tracking-widest">Factura simple</h1>
        <div className="text-right text-xs">
          <p className="font-mono text-sm font-bold tabular-nums">No. {invoice.number}</p>
          <p className="font-mono tabular-nums">
            {new Date(invoice.issuedAt).toLocaleString(currency.locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
      </section>

      <section className="grid gap-4 border-y border-black/20 py-4 text-xs sm:grid-cols-2">
        {hasBranch ? (
          <div>
            <p className="mb-1 text-st-overline font-bold uppercase tracking-widest opacity-70">
              Sucursal de retiro
            </p>
            {invoice.branchName ? <p className="text-sm font-semibold">{invoice.branchName}</p> : null}
            {branchLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {invoice.branchMapsUrl ? (
              // El mapa es un dato del local: se imprime el enlace, no un mapa embebido (eso pide red).
              <p className="break-all opacity-70">{invoice.branchMapsUrl}</p>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="mb-1 text-st-overline font-bold uppercase tracking-widest opacity-70">Cliente</p>
          <p className="text-sm font-semibold">{invoice.customerName}</p>
          {invoice.customerLegalName ? <p>{invoice.customerLegalName}</p> : null}
          {invoice.customerTaxId ? <p>RUC {invoice.customerTaxId}</p> : null}
        </div>
      </section>

      <table className="mt-5 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-black/40">
            <th className="w-8 py-2 font-bold uppercase tracking-wide">#</th>
            <th className="py-2 font-bold uppercase tracking-wide">Producto</th>
            <th className="w-16 py-2 text-right font-bold uppercase tracking-wide">Cant.</th>
            <th className="w-24 py-2 text-right font-bold uppercase tracking-wide">P. unit.</th>
            <th className="w-24 py-2 text-right font-bold uppercase tracking-wide">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-black/10 align-top">
              <td className="py-2 font-mono tabular-nums">{index + 1}</td>
              <td className="py-2">
                <p className="font-medium">{item.name}</p>
                {item.modifiers?.length ? (
                  <p className="opacity-70">{item.modifiers.join(" · ")}</p>
                ) : null}
                {item.notes ? <p className="opacity-70">{item.notes}</p> : null}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right font-mono tabular-nums">
                {moneyInBusiness(item.unitPrice)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {moneyInBusiness(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-5 flex flex-col gap-5 sm:flex-row sm:justify-between">
        <div className="order-2 text-xs sm:order-1 sm:max-w-[90mm]">
          <p className="mb-1 text-st-overline font-bold uppercase tracking-widest opacity-70">Pago</p>
          {payments.length === 0 ? (
            <p>Sin cobros registrados.</p>
          ) : (
            <ul>
              {payments.map((payment, index) => (
                <li key={`${payment.method}-${index}`} className="flex items-baseline gap-2">
                  <span className="font-medium">
                    {isSingleCash
                      ? `Pagó con ${moneyIn(payment.amount, payment.currency)}`
                      : `${PAYMENT_METHOD_TYPE_LABELS[payment.method]} ${moneyIn(payment.amount, payment.currency)}`}
                  </span>
                </li>
              ))}
              {isSingleCash && change > 0 ? (
                <li>
                  <span className="font-medium">Vuelto {moneyIn(change, businessCurrencyCode)}</span>
                </li>
              ) : null}
              {invoice.tipAmount > 0 ? (
                <li>
                  <span className="font-medium">Propina {moneyInBusiness(invoice.tipAmount)}</span>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <dl className="order-1 w-full text-xs sm:order-2 sm:w-[75mm]">
          <div className="flex items-baseline justify-between border-b border-black/10 py-1.5">
            <dt>Subtotal</dt>
            <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.subtotal)}</dd>
          </div>
          {invoice.discount > 0 ? (
            <div className="flex items-baseline justify-between border-b border-black/10 py-1.5">
              <dt>Descuento</dt>
              <dd className="font-mono tabular-nums">-{moneyInBusiness(invoice.discount)}</dd>
            </div>
          ) : null}
          {invoice.packagingAmount > 0 ? (
            <div className="flex items-baseline justify-between border-b border-black/10 py-1.5">
              <dt>Empaque</dt>
              <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.packagingAmount)}</dd>
            </div>
          ) : null}
          {invoice.tipAmount > 0 ? (
            <div className="flex items-baseline justify-between border-b border-black/10 py-1.5">
              <dt>Propina</dt>
              <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.tipAmount)}</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between border-t-2 border-black pt-2 text-base font-bold">
            <dt>TOTAL</dt>
            <dd className="font-mono tabular-nums">{moneyInBusiness(invoice.total)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-6 border-t border-black/20 pt-3 text-st-overline">
        <p className="font-semibold">Documento no fiscal.</p>
        <p className="opacity-70">
          Pedido <span className="font-mono tabular-nums">{orderNumber}</span> · {invoice.businessName}
          {invoice.branchName ? ` · ${invoice.branchName}` : ""}
        </p>
      </footer>
    </article>
  );
}
