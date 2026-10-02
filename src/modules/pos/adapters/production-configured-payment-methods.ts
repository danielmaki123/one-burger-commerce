import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { PaymentMethodConfigRecord } from "@/modules/payments/domain/payment-method-availability";
import { assertPaymentMethodKind } from "@/modules/payments/domain/payment-method-kind";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §38) — **el catálogo de medios configurado, leído una vez**.
 *
 * El POS necesita los medios que el dueño configuró en Finanzas para dibujar los botones correctos
 * («Efectivo», «Tarjeta BAC», «Zelle») y para que el servidor resuelva el tipo canónico desde el
 * `paymentMethodId`. Hasta esta TASK esa lectura vivía **sólo** dentro del adaptador de la venta rápida
 * (`production-pos-sale.ts`), así que el catálogo llegaba al `snapshot` pero nunca a la pantalla: el POS
 * visible seguía con la lista fija de `POS_PAYMENT_METHODS` (la divergencia de `A-85`).
 *
 * Se extrae acá —una sola lectura, un solo mapeo— y la venta rápida la reusa. **No** es un segundo catálogo:
 * es la misma tabla, leída por el mismo código.
 *
 * El **filtro por sucursal no se aplica acá**: el adaptador devuelve el catálogo completo, con las filas de
 * disponibilidad, y la regla la aplica el dominio de `payments` (`listAvailablePaymentMethods` /
 * `isPaymentMethodAvailableAt`), que es su dueño. Devolver las filas apagadas es deliberado: es lo que
 * permite que el error diga **por qué** un medio no se puede cobrar.
 */
export type ConfiguredPaymentMethodsPort = {
  listPaymentMethods: () => Promise<PaymentMethodConfigRecord[]>;
};

export function createProductionConfiguredPaymentMethods(): ConfiguredPaymentMethodsPort {
  return {
    listPaymentMethods: async () => {
      const rows = await getPrismaClient().paymentMethodConfig.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { locations: { select: { locationId: true, isActive: true } } },
      });

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: assertPaymentMethodKind(row.kind),
        entityId: row.entityId,
        currencyCodes: row.currencyCodes,
        requiresReference: row.requiresReference,
        isActive: row.isActive,
        locations: row.locations.map((location) => ({
          locationId: location.locationId,
          isActive: location.isActive,
        })),
      }));
    },
  };
}
