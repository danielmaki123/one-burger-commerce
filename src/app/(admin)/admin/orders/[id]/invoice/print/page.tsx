import { notFound, redirect } from "next/navigation";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaInvoiceRepository } from "@/modules/invoices/adapters/prisma-invoice-repository";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { getOrder } from "@/modules/orders/features/get-order/get-order";

import InvoicePrintButton from "./invoice-print-button";
import InvoicePrintSheet from "./invoice-print-sheet";

export const dynamic = "force-dynamic";

/**
 * Factura simple (2026-09-18) — la **hoja A4** del documento, lista para imprimir o guardar como PDF.
 *
 * Página propia y no una ventana emergente: el logo y las fuentes del sitio cargan bien, `Ctrl+P` sale
 * limpio y el enlace se puede guardar o compartir. Es HTML con CSS embebido y **sin dependencias nuevas**.
 *
 * Es un documento de impresión, así que el fondo es blanco aunque el panel sea oscuro: el `@media print`
 * esconde el panel entero (la barra lateral, la barra de acciones) y deja solo la hoja.
 */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!canManageOrderOperations(session.user.role)) {
    redirect("/admin/orders");
  }

  const { id } = await params;
  const order = await getOrder(id, {
    repository: new PrismaOrderRepository(),
    locationRepository: new PrismaLocationRepository(),
    paymentRepository: new PrismaPaymentRepository(),
  });

  const invoice = await new PrismaInvoiceRepository().findByOrderId(id);
  if (!invoice) {
    // Sin factura emitida no hay documento que imprimir: se vuelve al pedido, que es donde se emite.
    notFound();
  }

  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        /* La hoja es del rollo de 80 mm: ancho fijo y alto libre (2 mm de margen a los costados). */
        @page { size: 80mm auto; margin: 2mm; }
        @media print {
          /*
           * Solo se imprime la hoja: el panel del admin (barra lateral, navegación y contenedores) sale del
           * flujo con \`display: none\` —y no escondido con \`visibility\`, que deja el hueco y corta la
           * paginación de una factura larga—.
           */
          aside, nav { display: none !important; }
          main[data-admin-background] { padding: 0 !important; }
          [data-admin-main-inner] {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body { background: white !important; }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-[80mm] flex-wrap items-center justify-between gap-2 px-2 py-3 print:hidden">
        <a
          href={`/admin/orders/${encodeURIComponent(id)}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2"
        >
          Volver al pedido
        </a>
        <InvoicePrintButton />
      </div>

      <div data-invoice-sheet>
        <InvoicePrintSheet
          invoice={invoice}
          orderNumber={order.data.orderNumber}
          items={order.data.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            notes: item.notes,
            modifiers: item.modifiers.map((modifier) => modifier.name),
          }))}
          payments={order.data.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            currency: payment.currency,
            changeAmount: payment.changeAmount,
            tip: payment.tip,
          }))}
          logoUrl={settings.logoMarkUrl ?? null}
          customerWhatsapp={order.data.customerWhatsapp}
          businessCurrencyCode={settings.currencyCode}
          currency={{ symbol: settings.currencySymbol, locale: settings.locale }}
        />
      </div>
    </div>
  );
}
