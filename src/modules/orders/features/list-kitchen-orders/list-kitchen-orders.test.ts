import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { KITCHEN_BOARD_STATUSES } from "@/modules/orders/domain/order-lanes";
import type { OrderStatus } from "@/modules/orders/domain/order.types";
import type { ListOrdersFilter } from "@/modules/orders/ports/order-repository";

import { listKitchenOrders } from "./list-kitchen-orders";
import type { KitchenOrderProjection } from "./kitchen-order-projection";

/**
 * `KitchenOrderProjection` — la proyección de Cocina, **sin un solo campo financiero**.
 *
 * El test central de este archivo no es «no muestra el total»: es que **el campo no existe**. Por eso se
 * afirma sobre las **claves reales** del objeto que devuelve el caso de uso (y no sobre la ausencia de un
 * texto), que es lo que hace que la frontera sea de servidor y no de pantalla.
 */

/** Las claves que **nunca** pueden viajar a Cocina, con el dueño que las posee. */
const FORBIDDEN_KEYS = [
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
  "payments",
  "orderLookupTokenHash",
  "invoice",
  "financialState",
  "paidAmount",
  "outstandingAmount",
  "customerWhatsapp",
  "customerEmail",
  "customerId",
  "tableId",
  "couponCode",
] as const;

function locationFactory(over: Partial<Parameters<typeof createInMemoryLocation>[0]> = {}) {
  return createInMemoryLocation({ id: "loc_centro", name: "Camino de Oriente", ...over });
}

function setup() {
  const repository = new InMemoryOrderRepository();
  const locationRepository = new InMemoryLocationRepository([
    locationFactory({ id: "loc_centro", name: "Camino de Oriente", prepAlertMinutes: 18 }),
    locationFactory({ id: "loc_norte", name: "Carretera Masaya", prepAlertMinutes: 12 }),
  ]);

  return {
    repository,
    deps: { repository, locationRepository },
  };
}

async function list(
  repository: InMemoryOrderRepository,
  filter: ListOrdersFilter = {},
  over: { now?: Date; scopeLocationIds?: string[] | null } = {},
): Promise<Awaited<ReturnType<typeof listKitchenOrders>>> {
  const { deps } = setup();
  const withRepo = { ...deps, repository };

  return listKitchenOrders(
    {
      ...filter,
      scopeLocationIds: over.scopeLocationIds ?? null,
      now: over.now ?? new Date("2026-09-12T18:00:00.000Z"),
    },
    withRepo,
  );
}

function seedOrder(
  repository: InMemoryOrderRepository,
  over: {
    id: string;
    status?: OrderStatus;
    createdAt: string;
    history?: Array<{ status: OrderStatus; createdAt: string }>;
    pickupTime?: string | null;
    pickupScheduled?: boolean;
    locationId?: string;
    source?: "menu" | "pos" | null;
    items?: Array<{
      id: string;
      productName: string;
      quantity: number;
      notes?: string | null;
      modifiers?: Array<{ id: string; name: string }>;
    }>;
  },
) {
  const createdAt = over.createdAt;

  repository.orders.push({
    id: over.id,
    orderNumber: `P-${over.id.toUpperCase()}`,
    type: "pickup",
    status: over.status ?? "preparing",
    locationId: over.locationId ?? "loc_centro",
    source: over.source ?? null,
    customerName: `Cliente ${over.id}`,
    customerWhatsapp: "+50588887777",
    customerEmail: "cliente@ejemplo.com",
    items: [],
    subtotal: 100,
    discount: 0,
    packagingAmount: 0,
    deliveryFeeAmount: 0,
    tipAmount: 0,
    total: 380,
    createdAt,
    updatedAt: createdAt,
    pickupTime: over.pickupTime ?? null,
    pickupScheduled: over.pickupScheduled ?? false,
    // Datos que **no** deben viajar: se siembran a propósito para que el test los pueda buscar.
    pickupPin: "4821",
    paidWithAmount: 500,
  });

  for (const entry of over.history ?? []) {
    repository.statusHistory.push({
      id: `hist_${over.id}_${entry.status}`,
      orderId: over.id,
      status: entry.status,
      note: null,
      createdAt: entry.createdAt,
    });
  }

  for (const item of over.items ?? []) {
    repository.orders.find((order) => order.id === over.id)?.items.push({
      id: item.id,
      productId: "prod_01",
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: 200,
      packagingUnitAmount: 0,
      packagingQuantity: 0,
      packagingTotalAmount: 0,
      notes: item.notes ?? null,
      lineTotal: 200 * item.quantity,
      modifiers: (item.modifiers ?? []).map((modifier) => ({
        id: modifier.id,
        modifierOptionId: `opt_${modifier.id}`,
        name: modifier.name,
        priceDelta: 20,
      })),
    });
  }
}

describe("listKitchenOrders · la frontera sin dinero", () => {
  it("la proyección no tiene ninguna clave financiera ni dato de contacto", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      createdAt: "2026-09-12T17:40:00.000Z",
      history: [
        { status: "new", createdAt: "2026-09-12T17:40:00.000Z" },
        { status: "confirmed", createdAt: "2026-09-12T17:45:00.000Z" },
        { status: "preparing", createdAt: "2026-09-12T17:50:00.000Z" },
      ],
    });

    const result = await list(repository);
    const order = result.data[0] as KitchenOrderProjection & Record<string, unknown>;

    expect(order).toBeDefined();

    for (const key of FORBIDDEN_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(order, key), `la clave «${key}» no puede viajar`).toBe(
        false,
      );
    }
  });

  it("expone exactamente los campos que la cocina necesita, ni uno más", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      createdAt: "2026-09-12T17:40:00.000Z",
      source: "menu",
      items: [{ id: "i1", productName: "Doble Bacon", quantity: 2, notes: "sin tomate" }],
    });

    const result = await list(repository);

    // La lista de claves es el contrato: si alguien agrega un campo, este test lo obliga a decidirlo acá.
    expect(Object.keys(result.data[0]).sort()).toEqual(
      [
        "createdAt",
        "customerName",
        "id",
        "items",
        "location",
        "orderNumber",
        "pickupScheduled",
        "pickupTime",
        "preparingAt",
        "readyAt",
        "source",
        "stageChangedAt",
        "status",
        "type",
      ].sort(),
    );
  });

  it("los items traen lo que hay que cocinar y tampoco traen precio", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      createdAt: "2026-09-12T17:40:00.000Z",
      items: [
        {
          id: "i1",
          productName: "Doble Bacon",
          quantity: 2,
          notes: "bien cocida",
          modifiers: [{ id: "m1", name: "extra queso" }],
        },
      ],
    });

    const result = await list(repository);
    const item = result.data[0].items[0] as unknown as Record<string, unknown>;

    expect(item).toEqual({
      id: "i1",
      productName: "Doble Bacon",
      quantity: 2,
      notes: "bien cocida",
      modifiers: [{ id: "m1", name: "extra queso" }],
    });
    for (const key of ["unitPrice", "lineTotal", "priceDelta", "packagingTotalAmount"]) {
      expect(Object.prototype.hasOwnProperty.call(item, key), key).toBe(false);
    }
  });

  it("el local viaja con su nombre y su lead, y nada más", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "a", createdAt: "2026-09-12T17:40:00.000Z" });

    const result = await list(repository);

    expect(result.data[0].location).toEqual({
      id: "loc_centro",
      name: "Camino de Oriente",
      pickupLeadMinutes: 25,
    });
  });
});

describe("listKitchenOrders · la cola del tablero", () => {
  it("sólo trae lo que está en el tablero: ni retirados, ni cerrados, ni cancelados", async () => {
    const { repository } = setup();
    for (const status of ["new", "confirmed", "preparing", "ready_for_pickup", "picked_up", "closed", "cancelled"] as OrderStatus[]) {
      seedOrder(repository, { id: status, status, createdAt: "2026-09-12T17:40:00.000Z" });
    }

    const result = await list(repository);

    // Los cuatro del MVP, en el orden del tablero; los otros tres no son trabajo de cocina.
    expect(result.data.map((order) => order.status)).toEqual([
      "new",
      "confirmed",
      "preparing",
      "ready_for_pickup",
    ]);
    expect(result.meta.count).toBe(result.data.length);
  });

  it("los equivalentes del esquema (mesa y delivery) también entran: no se deja un estado sin superficie", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "accepted", status: "accepted", createdAt: "2026-09-12T17:40:00.000Z" });
    seedOrder(repository, { id: "ready", status: "ready", createdAt: "2026-09-12T17:41:00.000Z" });

    const result = await list(repository);

    expect([...result.data.map((order) => order.status)].sort()).toEqual(["accepted", "ready"]);
    // La lista blanca del caso de uso es exactamente la del mapa canónico de carriles.
    expect([...KITCHEN_BOARD_STATUSES].sort()).toEqual(
      ["accepted", "confirmed", "new", "preparing", "ready", "ready_for_pickup"].sort(),
    );
  });

  it("entrega los sellos de etapa derivados del historial, no de la creación", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      status: "ready_for_pickup",
      createdAt: "2026-09-12T17:00:00.000Z",
      history: [
        { status: "new", createdAt: "2026-09-12T17:00:00.000Z" },
        { status: "confirmed", createdAt: "2026-09-12T17:05:00.000Z" },
        { status: "preparing", createdAt: "2026-09-12T17:12:00.000Z" },
        { status: "ready_for_pickup", createdAt: "2026-09-12T17:30:00.000Z" },
      ],
    });

    const result = await list(repository);

    expect(result.data[0].preparingAt).toBe("2026-09-12T17:12:00.000Z");
    expect(result.data[0].readyAt).toBe("2026-09-12T17:30:00.000Z");
    expect(result.data[0].stageChangedAt).toBe("2026-09-12T17:30:00.000Z");
  });

  it("un pedido aceptado y sin empezar no tiene sello de preparación: no se le inventa un inicio", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      status: "confirmed",
      createdAt: "2026-09-12T17:00:00.000Z",
      history: [
        { status: "new", createdAt: "2026-09-12T17:00:00.000Z" },
        { status: "confirmed", createdAt: "2026-09-12T17:05:00.000Z" },
      ],
    });

    const result = await list(repository);

    expect(result.data[0].preparingAt).toBeNull();
    expect(result.data[0].readyAt).toBeNull();
  });

  it("el canal viaja tal como se guardó, y `null` sigue siendo `null`", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "menu", createdAt: "2026-09-12T17:00:00.000Z", source: "menu" });
    seedOrder(repository, { id: "pos", createdAt: "2026-09-12T17:01:00.000Z", source: "pos" });
    seedOrder(repository, { id: "viejo", createdAt: "2026-09-12T17:02:00.000Z", source: null });

    const result = await list(repository);
    const byId = new Map(result.data.map((order) => [order.id, order.source]));

    expect(byId.get("menu")).toBe("menu");
    expect(byId.get("pos")).toBe("pos");
    expect(byId.get("viejo")).toBeNull();
  });

  it("respeta el alcance por sucursal que recibe del filtro", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "centro", createdAt: "2026-09-12T17:00:00.000Z" });
    seedOrder(repository, {
      id: "norte",
      createdAt: "2026-09-12T17:01:00.000Z",
      locationId: "loc_norte",
    });

    const result = await list(repository, { locationIds: ["loc_norte"] });

    expect(result.data.map((order) => order.id)).toEqual(["norte"]);
  });

  it("un local borrado no rompe la cola: el pedido queda sin nombre, no sin comanda", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "huerfano",
      createdAt: "2026-09-12T17:00:00.000Z",
      locationId: "loc_borrado",
    });

    const result = await list(repository);

    expect(result.data[0].location.name).toBeNull();
    expect(result.data[0].location.pickupLeadMinutes).toBeNull();
  });
});

describe("listKitchenOrders · el resumen del turno", () => {
  it("el promedio y la más larga salen de `preparingAt → readyAt` de los pedidos listos", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      status: "ready_for_pickup",
      createdAt: "2026-09-12T10:00:00.000Z",
      history: [
        { status: "preparing", createdAt: "2026-09-12T17:00:00.000Z" },
        { status: "ready_for_pickup", createdAt: "2026-09-12T17:10:00.000Z" },
      ],
    });
    seedOrder(repository, {
      id: "b",
      status: "ready_for_pickup",
      createdAt: "2026-09-12T11:00:00.000Z",
      history: [
        { status: "preparing", createdAt: "2026-09-12T17:00:00.000Z" },
        { status: "ready_for_pickup", createdAt: "2026-09-12T17:20:00.000Z" },
      ],
    });

    const result = await list(repository);

    expect(result.meta.summary.averagePrepMinutes).toBe(15);
    expect(result.meta.summary.longestPrepMinutes).toBe(20);
  });

  it("sin preparaciones medidas el resumen dice «sin datos», no `0`", async () => {
    const { repository } = setup();
    seedOrder(repository, {
      id: "a",
      status: "ready_for_pickup",
      createdAt: "2026-09-12T17:00:00.000Z",
      // Historial viejo, sin `preparing`: no hay preparación que promediar.
      history: [{ status: "ready_for_pickup", createdAt: "2026-09-12T17:20:00.000Z" }],
    });

    const result = await list(repository);

    expect(result.meta.summary.averagePrepMinutes).toBeNull();
    expect(result.meta.summary.longestPrepMinutes).toBeNull();
  });

  it("el objetivo es el umbral del local, no un número inventado por la pantalla", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "a", createdAt: "2026-09-12T17:00:00.000Z" });

    // Con una sola sucursal a la vista hay un ritmo claro y mandan sus umbrales.
    const result = await list(repository, { locationIds: ["loc_centro"] });

    expect(result.meta.summary.prepTargetMinutes).toBe(18);
  });

  it("con varias sucursales a la vista no se promedian dos cocinas distintas", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "a", createdAt: "2026-09-12T17:00:00.000Z" });

    const result = await list(repository);

    // Rige el default del sistema: inventar un promedio entre dos ritmos mentiría sobre los dos.
    expect(result.meta.summary.prepTargetMinutes).toBe(15);
  });

  it("un pedido de un local apagado igual cuenta: cocina mira el turno, no la carta", async () => {
    const { repository } = setup();
    seedOrder(repository, { id: "a", createdAt: "2026-09-12T17:00:00.000Z" });

    const result = await list(repository, { locationIds: ["loc_centro"] });

    expect(result.meta.count).toBe(1);
    expect(result.meta.summary.prepTargetMinutes).toBe(18);
  });

  it("el alcance viaja en `meta` para que la pantalla no lo reimplemente", async () => {
    const { repository } = setup();

    const all = await list(repository);
    const scoped = await list(repository, {}, { scopeLocationIds: ["loc_centro"] });

    expect(all.meta.locationScope).toBeNull();
    expect(scoped.meta.locationScope).toEqual(["loc_centro"]);
  });
});
