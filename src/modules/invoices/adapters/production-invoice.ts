import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";

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

  return {
    invoiceRepository: new PrismaInvoiceRepository(),
    findOrder: (orderId) => orderRepository.findOrderById(orderId),
    countPayments: async (orderId) => (await paymentRepository.listPaymentsByOrder(orderId)).length,
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
      currencyCode: settings.currencyCode,
    },
  };
}
