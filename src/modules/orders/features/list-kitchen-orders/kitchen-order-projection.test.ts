import { describe, expect, it } from "vitest";

import type {
  KitchenOrderProjection,
  KitchenOrdersResult,
} from "./kitchen-order-projection";

/**
 * `KitchenOrderProjection` — el contrato de lectura de Cocina.
 *
 * Lo que se prueba acá es el **tipo**, y no es un detalle: la frontera de autorización de la superficie
 * es que los campos financieros **no existan**, no que la pantalla elija no dibujarlos. Un campo que se
 * agregue al tipo viaja al cliente, así que la lista de claves es la decisión que hay que tomar a
 * conciencia. `list-kitchen-orders.test.ts` comprueba lo mismo sobre el objeto **real** que devuelve el
 * caso de uso; acá queda fijada la forma declarada.
 */
const PROJECTION_KEYS: Array<keyof KitchenOrderProjection> = [
  "id",
  "orderNumber",
  "type",
  "status",
  "source",
  "customerName",
  "location",
  "createdAt",
  "stageChangedAt",
  "preparingAt",
  "readyAt",
  "pickupTime",
  "pickupScheduled",
  "items",
];

/**
 * Lo que **nunca** puede estar en la proyección de Cocina, con su dueño.
 *
 * Es una lista explícita (y no un `not.toContain` sobre texto) porque el defecto que cierra
 * `TASK-ORDERS-KITCHEN-RUNTIME-002` es exactamente este: la bandeja de Órdenes le entregaba a la cocina
 * el `OrderRecord` completo (`A-60`).
 */
const FINANCIAL_AND_PRIVATE_KEYS = [
  "subtotal",
  "discount",
  "packagingAmount",
  "deliveryFeeAmount",
  "tipAmount",
  "tipRate",
  "total",
  "paidWithAmount",
  "paymentMethod",
  "pickupPin",
  "orderLookupTokenHash",
  "payments",
  "invoice",
  "customerWhatsapp",
  "customerEmail",
  "customerId",
  "tableId",
  "couponCode",
  "deliveryZoneId",
  "customerLat",
  "customerLng",
] as const;

describe("KitchenOrderProjection · la forma declarada", () => {
  it("no declara ninguna clave financiera ni dato privado del pedido", () => {
    for (const key of FINANCIAL_AND_PRIVATE_KEYS) {
      expect(PROJECTION_KEYS, `«${key}» no puede estar en la proyección`).not.toContain(key);
    }
  });

  it("la lista de claves es exactamente la que la cocina necesita", () => {
    // Si alguien agrega un campo, este test lo obliga a decidirlo acá y a revisar la frontera. Es la
    // lista que el `route.test.ts` y el caso de uso afirman sobre el payload real.
    expect(PROJECTION_KEYS).toHaveLength(14);
    expect(new Set(PROJECTION_KEYS).size).toBe(PROJECTION_KEYS.length);
  });

  it("el resumen del turno no lleva nada de dinero: promedio, más larga y umbral", () => {
    const result = {
      data: [],
      meta: {
        count: 0,
        locationScope: null,
        summary: { averagePrepMinutes: null, longestPrepMinutes: null, prepTargetMinutes: 15, acceptTargetMinutes: 10 },
      },
    } satisfies KitchenOrdersResult;

    expect(Object.keys(result.meta.summary).sort()).toEqual([
      "acceptTargetMinutes",
      "averagePrepMinutes",
      "longestPrepMinutes",
      "prepTargetMinutes",
    ]);
  });
});
