import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
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
  const locationRepository = new PrismaLocationRepository();
  const customerRepository = new PrismaCustomerAuthRepository();

  return {
    invoiceRepository: new PrismaInvoiceRepository(),
    findOrder: (orderId) => orderRepository.findOrderById(orderId),
    countPayments: async (orderId) => (await paymentRepository.listPaymentsByOrder(orderId)).length,
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
      currencyCode: settings.currencyCode,
    },
  };
}
