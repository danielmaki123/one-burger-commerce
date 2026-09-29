import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { getOrderPaymentStatus } from "@/modules/payments/features/get-order-payment-status/get-order-payment-status";

import type { EmitInvoiceDependencies } from "../features/emit-invoice/emit-invoice";
import { PrismaInvoiceRepository } from "./prisma-invoice-repository";

/**
 * Factura simple (2026-09-18) — la emisión del documento en producción.
 *
 * Vive acá y no en la ruta porque instancia Prisma. El pedido se lee con el repositorio de órdenes (el
 * mismo de siempre) y los datos del negocio salen de la configuración: nada del documento está hardcodeado.
 */
export async function createProductionInvoiceDependencies(): Promise<EmitInvoiceDependencies> {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const orderRepository = new PrismaOrderRepository();
  const paymentRepository = new PrismaPaymentRepository();
  const locationRepository = new PrismaLocationRepository();
  const customerRepository = new PrismaCustomerAuthRepository();

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — **la moneda base sale de `money`**.
   *
   * La configuración de branding dejó de ser la autoridad monetaria: si la factura leyera
   * `BusinessSettings.currencyCode` mientras Finanzas escribe en `BusinessCurrencySettings`, un cambio de base
   * haría que el documento se formatee contra una moneda que no es la que el negocio usa hoy.
   */
  const money = await readProductionMoney();

  return {
    invoiceRepository: new PrismaInvoiceRepository(),
    findOrder: (orderId) => orderRepository.findOrderById(orderId),
    /**
     * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-021`) — **el estado financiero lo proyecta `payments`**.
     *
     * Antes acá se contaban filas (`listPaymentsByOrder(orderId).length`) y ese conteo era la puerta de la
     * factura: un pedido con un cobro parcial facturaba. El módulo de facturas **consume** el estado
     * canónico —con su `unresolvedAmount`— y no decide «pagado».
     *
     * El estado se arma con la **moneda base configurada** y con el **snapshot** de cada cobro: el equivalente
     * de un cobro nuevo ya está escrito, así que no se vuelve a convertir. Un cobro legacy sin snapshot queda
     * como no demostrable y el pedido no alcanza `paid`, que es exactamente lo que `D-020`/`D-021` piden.
     */
    getOrderPaymentStatus: async (orderId) => {
      const [payments, order] = await Promise.all([
        paymentRepository.listPaymentsByOrder(orderId),
        orderRepository.findOrderById(orderId),
      ]);
      const status = await getOrderPaymentStatus({
        orderId,
        total: order?.total ?? 0,
        baseCurrencyCode: money.context.baseCurrencyCode,
        payments: payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          baseCurrencyCode: payment.baseCurrencyCode ?? null,
          exchangeRate: payment.exchangeRate ?? null,
          baseAmount: payment.baseAmount ?? null,
          method: payment.method,
          createdAt: payment.createdAt,
          voidedAt: payment.voidedAt,
        })),
      });

      return {
        status: status.status,
        paidAmount: status.paidAmount,
        outstandingAmount: status.outstandingAmount,
        unresolvedAmount: status.unresolvedAmount,
      };
    },
    /**
     * Punto 4 del roadmap (2026-09-18) — el cliente del pedido, para el respaldo de los datos fiscales: el
     * RUC que el cajero cargó en el POS quedó guardado en el cliente, no en el pedido.
     */
    findCustomer: async (customerId) => {
      const customer = await customerRepository.findCustomerById(customerId);
      if (!customer) return null;

      return { legalName: customer.legalName ?? null, taxId: customer.taxId ?? null };
    },
    /**
     * La sucursal del pedido, para congelarla en el documento. Sin local (o sin datos) el bloque no se
     * imprime: el documento no inventa una dirección.
     */
    findBranch: async (locationId) => {
      const location = await locationRepository.findLocationById(locationId);
      if (!location) return null;

      return {
        name: location.name,
        addressLine: location.addressLine,
        city: location.city,
        phone: location.phone,
        whatsapp: location.whatsapp,
        mapsUrl: location.mapsUrl,
      };
    },
    business: {
      name: settings.name,
      legalName: settings.legalName,
      taxId: settings.taxId,
      // Los datos fiscales (Personalización → Datos fiscales) son los que van al documento; sin ellos, el
      // contacto de siempre. La decisión la toma el caso de uso, que es el que sabe qué se imprime.
      taxAddress: settings.taxAddress,
      taxPhone: settings.taxPhone,
      addressLine: settings.addressLine,
      city: settings.city,
      phone: settings.phone,
      /**
       * `A-83` — la moneda base vigente, de `money`. Es el **default** de una factura nueva; una factura ya
       * emitida se formatea con su propia moneda congelada (`Invoice.currencyCode`), no con esta.
       */
      currencyCode: money.context.baseCurrencyCode,
    },
  };
}
