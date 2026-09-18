/**
 * Factura simple (2026-09-18) — el documento del pedido, en texto plano.
 *
 * **No es una factura fiscal**: no hay autorización de la DGI ni rango oficial. Es el papel que el cliente
 * se lleva, así que dice lo que compró, lo que pagó y los datos del negocio y del cliente tal como estaban
 * al emitir. Se imprime con la hoja del sistema (`printLines`) y el navegador la guarda como PDF: la misma
 * decisión que la hoja de cierre (1.6), sin dependencias nuevas.
 *
 * Es una función pura (datos adentro, texto afuera) para poder probarla sin navegador. El formato de plata
 * sale de `formatSheetAmount` (el mismo de los otros papeles) y los números **no se recalculan acá**: llegan
 * congelados en la factura.
 */

import { formatSheetAmount } from "@/shared/lib/shift-sheet-format";
import type { InvoiceRecord } from "@/modules/invoices/domain/invoice";
import type { CurrencyFormat } from "@/shared/lib/format-currency";

/** Ancho de la hoja: el mismo de los tickets y de la hoja de cierre. */
const WIDTH = 42;

function line(left: string, right: string): string {
  const space = Math.max(WIDTH - left.length - right.length, 1);

  return `${left}${" ".repeat(space)}${right}`;
}

function center(text: string): string {
  const padding = Math.max(Math.floor((WIDTH - text.length) / 2), 0);

  return `${" ".repeat(padding)}${text}`;
}

const SEPARATOR = "-".repeat(WIDTH);

export type InvoiceSheetLine = { name: string; quantity: number; unitPrice: number; lineTotal: number };

export type InvoiceSheetInput = {
  invoice: InvoiceRecord;
  /** Las líneas del pedido, tal como quedaron (el documento no las recalcula). */
  lines: InvoiceSheetLine[];
  /** El formato del negocio (símbolo y locale). */
  currency: CurrencyFormat;
  /**
   * La moneda del negocio. La factura guarda su propia moneda: una emitida en otra se imprime con su
   * código (`USD 20.00`), no con el símbolo del negocio, que mentiría sobre lo que se cobró.
   */
  businessCurrencyCode: string;
  /** Nombre del local de retiro, si se conoce. */
  locationName?: string | null;
};

export function invoiceSheetLines(input: InvoiceSheetInput): string[] {
  const { invoice, lines, currency } = input;
  const money = (amount: number) =>
    formatSheetAmount(amount, invoice.currencyCode, {
      currencyCode: input.businessCurrencyCode,
      currencySymbol: currency.symbol,
      locale: currency.locale,
    });

  const header = [
    center(invoice.businessLegalName ?? invoice.businessName),
    ...(invoice.businessLegalName ? [center(invoice.businessName)] : []),
    ...(invoice.businessTaxId ? [center(`RUC ${invoice.businessTaxId}`)] : []),
    ...(invoice.businessAddress ? [center(invoice.businessAddress)] : []),
    ...(invoice.businessPhone ? [center(invoice.businessPhone)] : []),
    "",
    center("FACTURA SIMPLE"),
    center(`No. ${invoice.number}`),
    center(new Date(invoice.issuedAt).toLocaleString(currency.locale, {
      dateStyle: "short",
      timeStyle: "short",
    })),
    SEPARATOR,
    `Cliente: ${invoice.customerName}`,
    ...(invoice.customerLegalName ? [`Razon social: ${invoice.customerLegalName}`] : []),
    ...(invoice.customerTaxId ? [`RUC: ${invoice.customerTaxId}`] : []),
    ...(input.locationName ? [`Retiro: ${input.locationName}`] : []),
    SEPARATOR,
  ];

  const items = lines.flatMap((item) => [
    item.name,
    line(
      `  ${item.quantity} x ${money(item.unitPrice)}`,
      money(item.lineTotal),
    ),
  ]);

  const totals = [
    SEPARATOR,
    line("Subtotal", money(invoice.subtotal)),
    ...(invoice.discount > 0 ? [line("Descuento", `-${money(invoice.discount)}`)] : []),
    ...(invoice.packagingAmount > 0 ? [line("Empaque", money(invoice.packagingAmount))] : []),
    ...(invoice.deliveryFeeAmount > 0 ? [line("Envio", money(invoice.deliveryFeeAmount))] : []),
    ...(invoice.tipAmount > 0 ? [line("Propina", money(invoice.tipAmount))] : []),
    line("TOTAL", money(invoice.total)),
    SEPARATOR,
    "",
    center("Documento no fiscal."),
    center("Gracias por su compra."),
  ];

  return [...header, ...items, ...totals];
}
