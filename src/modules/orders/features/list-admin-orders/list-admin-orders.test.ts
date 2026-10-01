import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { listAdminOrders } from "@/modules/orders/features/list-admin-orders/list-admin-orders";
import type { AdminOrderRow } from "@/modules/orders/ports/order-repository";
import type { OrderPaymentStatusValue } from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-ORDERS-RUNTIME-5B` — el **read model** del listado administrativo de Pedidos.
 *
 * Lo que este caso de uso garantiza, y que la pantalla vieja no hacía:
 *
 * 1. **Pagina**: devuelve `page`/`pageSize`/`total`, y el `total` es del **filtro**, no de la página.
 * 2. **Los KPI son del filtro completo**: cambiar de página no puede cambiar un número de la cabecera.
 * 3. **El estado financiero lo resuelve `payments`**: acá se consume la proyección y se filtra por ella
 *    («Pendientes» = `pending` + `partial`), sin sumar un solo `Payment.amount` a mano.
 * 4. **Ninguna fila lleva lo prohibido**: ni `orderLookupTokenHash`, ni GPS, ni items, ni historial.
 *
 * El caso de uso recibe las **filas mínimas** del repositorio (`AdminOrderRow`) y la resolución del estado
 * financiero por inyección, igual que `emit-invoice` recibe `getOrderPaymentStatus`: así el doble del test
 * no puede mentir sobre la regla que se está probando.
 */

const BASE = "NIO";

/** Doble del repositorio de filas: aplica **todo** lo que el puerto promete filtrar. */
class RowRepository extends InMemoryOrderRepository {
  rows: AdminOrderRow[] = [];

  async listAdminOrderRows(filter: Parameters<InMemoryOrderRepository["listAdminOrderRows"]>[0] = {}) {
    return this.rows.filter((entry) => {
      if (filter.statuses?.length && !filter.statuses.includes(entry.status)) return false;
      if (filter.locationIds?.length && !filter.locationIds.includes(entry.locationId)) return false;
      if (filter.dateFrom && entry.createdAt < filter.dateFrom) return false;
      if (filter.dateTo && entry.createdAt > filter.dateTo) return false;
      if (filter.scheduledOnly && !entry.pickupScheduled) return false;

      return true;
    });
  }
}

function row(overrides: Partial<AdminOrderRow> & { id: string; orderNumber: string }): AdminOrderRow {
  return {
    source: "menu",
    status: "new",
    type: "pickup",
    customerName: "Cliente",
    customerWhatsapp: "+50588887777",
    locationId: "loc_principal",
    pickupTime: null,
    pickupScheduled: false,
    total: 100,
    currencyCode: BASE,
    stageChangedAt: "2026-09-30T18:00:00.000Z",
    createdAt: "2026-09-30T18:00:00.000Z",
    payments: [],
    ...overrides,
  };
}

/**
 * El estado financiero **por pedido**, con la precedencia de `D-020` escrita acá a mano a partir de la
 * regla del negocio (no se reusa `projectOrderPaymentStatus`, que es lo que se está probando).
 *
 * `paid` ⇔ saldo 0 **y** nada sin demostrar. Si no: `partial` cuando hay algo cobrado o algo no
 * demostrable, y `pending` cuando no hay nada.
 */
function financialStateOf(order: { total: number; payments: AdminOrderRow["payments"] }) {
  let paid = 0;
  let unresolved = 0;

  for (const payment of order.payments) {
    if (payment.voidedAt !== null) continue;
    if (payment.baseAmount !== null) paid += payment.baseAmount;
    else if (payment.currency === null || payment.currency === BASE) paid += payment.amount;
    else unresolved += payment.amount;
  }

  const outstanding = Math.max(0, order.total - paid);
  const status: OrderPaymentStatusValue =
    outstanding === 0 && unresolved === 0 ? "paid" : paid > 0 || unresolved > 0 ? "partial" : "pending";

  return { status, paidAmount: paid, outstandingAmount: outstanding, unresolvedAmount: unresolved };
}

const locations = () =>
  new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 1 }),
  ]);

async function list(
  repo: RowRepository,
  filter: Parameters<typeof listAdminOrders>[0] = {},
) {
  return listAdminOrders(filter, {
    repository: repo,
    locationRepository: locations(),
    baseCurrencyCode: BASE,
    resolveFinancialState: async (orderId) => {
      const target = repo.rows.find((candidate) => candidate.id === orderId);
      if (!target) throw new Error(`fila inexistente: ${orderId}`);

      return financialStateOf(target);
    },
  });
}

describe("listAdminOrders · paginación", () => {
  function repoWith(count: number) {
    const repo = new RowRepository();
    for (let index = 0; index < count; index += 1) {
      repo.rows.push(
        row({
          id: `ord_${index}`,
          orderNumber: `P-${String(index).padStart(3, "0")}`,
          // Del más nuevo al más viejo: el orden de la referencia aprobada.
          createdAt: `2026-09-30T${String(10 + Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`,
        }),
      );
    }

    return repo;
  }

  it("la primera página trae el tamaño pedido y el total del filtro", async () => {
    const result = await list(repoWith(30), { page: 1, pageSize: 10 });

    expect(result.data).toHaveLength(10);
    expect(result.meta).toEqual({ page: 1, pageSize: 10, total: 30 });
  });

  it("la segunda página trae las siguientes, sin repetir ninguna", async () => {
    const first = await list(repoWith(30), { page: 1, pageSize: 10 });
    const second = await list(repoWith(30), { page: 2, pageSize: 10 });

    const firstIds = first.data.map((entry) => entry.id);
    const secondIds = second.data.map((entry) => entry.id);

    expect(secondIds).toHaveLength(10);
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
  });

  it("una página fuera de rango devuelve vacío con el total intacto", async () => {
    const result = await list(repoWith(30), { page: 9, pageSize: 10 });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(30);
  });

  it("sin `page`/`pageSize` usa la primera página y el tamaño por defecto", async () => {
    const result = await list(repoWith(3), {});

    expect(result.meta.page).toBe(1);
    expect(result.meta.pageSize).toBe(25);
  });

  it("el tamaño de página tiene techo: no se puede pedir la tabla entera «paginando»", async () => {
    const result = await list(repoWith(120), { page: 1, pageSize: 5_000 });

    expect(result.meta.pageSize).toBe(100);
    expect(result.data).toHaveLength(100);
  });

  it("una página inválida cae a la primera en vez de devolver basura", async () => {
    const result = await list(repoWith(30), { page: 0, pageSize: -4 });

    expect(result.meta.page).toBe(1);
    expect(result.meta.pageSize).toBe(25);
  });

  it("ordena por más recientes primero", async () => {
    const repo = new RowRepository();
    repo.rows.push(
      row({ id: "viejo", orderNumber: "P-VIEJO", createdAt: "2026-09-30T10:00:00.000Z" }),
      row({ id: "nuevo", orderNumber: "P-NUEVO", createdAt: "2026-09-30T20:00:00.000Z" }),
    );

    const result = await list(repo);

    expect(result.data.map((entry) => entry.id)).toEqual(["nuevo", "viejo"]);
  });
});

describe("listAdminOrders · los cuatro KPI del filtro completo", () => {
  /**
   * El escenario tiene, a propósito, los KPI repartidos entre la página 1 y la 2: si alguien calculara los
   * agregados sobre la página visible, los números cambiarían al paginar y este test lo caza.
   */
  function repoForKpis() {
    const repo = new RowRepository();
    repo.rows.push(
      // Programado, activo, sin cobro.
      row({ id: "ord_1", orderNumber: "P-1", status: "new", pickupScheduled: true, pickupTime: "2026-10-01T18:00:00.000Z" }),
      // Activo, cobrado completo (100 de 100).
      row({
        id: "ord_2",
        orderNumber: "P-2",
        status: "preparing",
        total: 100,
        payments: [
          { id: "pay_1", amount: 100, currency: BASE, baseCurrencyCode: BASE, exchangeRate: null, baseAmount: 100, method: "cash", createdAt: "2026-09-30T18:05:00.000Z", voidedAt: null },
        ],
      }),
      // Cerrado, parcial (deuda viva): cuenta como pendiente de pago.
      row({
        id: "ord_3",
        orderNumber: "P-3",
        status: "closed",
        total: 200,
        payments: [
          { id: "pay_2", amount: 50, currency: BASE, baseCurrencyCode: BASE, exchangeRate: null, baseAmount: 50, method: "cash", createdAt: "2026-09-30T18:06:00.000Z", voidedAt: null },
        ],
      }),
      // Cancelado: no es trabajo vivo, y sin cobros queda pendiente de pago.
      row({ id: "ord_4", orderNumber: "P-4", status: "cancelled" }),
    );

    return repo;
  }

  it("cuenta total, activos, pendientes de pago y programados", async () => {
    const result = await list(repoForKpis());

    // Total 4 · activos 2 (`new` y `preparing`: el cerrado y el cancelado no son trabajo vivo) ·
    // **pendientes de pago 3** —el sin cobro, el cancelado sin cobro y el parcial—: `paid` es sólo el
    // cobrado completo, y un parcial con deuda viva sigue siendo deuda (`D-020`) · programados 1.
    expect(result.kpi).toEqual({ total: 4, active: 2, pendingPayment: 3, scheduled: 1 });
  });

  it("el KPI no cambia al cambiar de página", async () => {
    const repo = repoForKpis();

    const first = await list(repo, { page: 1, pageSize: 2 });
    const second = await list(repo, { page: 2, pageSize: 2 });

    // Las páginas son distintas...
    expect(first.data.map((entry) => entry.id)).not.toEqual(second.data.map((entry) => entry.id));
    // ...y los números de la cabecera son los mismos.
    expect(second.kpi).toEqual(first.kpi);
    expect(second.meta.total).toBe(first.meta.total);
  });

  it("los KPI se calculan sobre el filtro, no sobre todo el universo", async () => {
    const repo = repoForKpis();
    repo.rows.push(row({ id: "ord_5", orderNumber: "P-5", locationId: "loc_norte" }));

    const result = await list(repo, { locationIds: ["loc_principal"] });

    expect(result.kpi.total).toBe(4);
  });
});

describe("listAdminOrders · el filtro por estado de pago consume `payments`", () => {
  function repoWith(mix: Array<{ id: string; total: number; paid: number; unresolved?: number }>) {
    const repo = new RowRepository();

    for (const entry of mix) {
      const payments: AdminOrderRow["payments"] = [];

      if (entry.paid > 0) {
        payments.push({
          id: `pay_${entry.id}`,
          amount: entry.paid,
          currency: BASE,
          baseCurrencyCode: BASE,
          exchangeRate: null,
          baseAmount: entry.paid,
          method: "cash",
          createdAt: "2026-09-30T18:00:00.000Z",
          voidedAt: null,
        });
      }

      if (entry.unresolved && entry.unresolved > 0) {
        // Un cobro legacy en otra moneda, sin snapshot: su equivalente **no se puede demostrar**.
        payments.push({
          id: `pay_legacy_${entry.id}`,
          amount: entry.unresolved,
          currency: "USD",
          baseCurrencyCode: null,
          exchangeRate: null,
          baseAmount: null,
          method: "cash",
          createdAt: "2026-09-30T18:01:00.000Z",
          voidedAt: null,
        });
      }

      repo.rows.push(row({ id: entry.id, orderNumber: `P-${entry.id}`, total: entry.total, payments }));
    }

    return repo;
  }

  it("«Pendientes» incluye pending y partial, y deja paid afuera", async () => {
    const repo = repoWith([
      { id: "sin_cobro", total: 100, paid: 0 },
      { id: "parcial", total: 200, paid: 50 },
      { id: "pagado", total: 300, paid: 300 },
    ]);

    const result = await list(repo, { payment: "pending" });

    expect(result.data.map((entry) => entry.id).sort()).toEqual(["parcial", "sin_cobro"]);
    expect(result.meta.total).toBe(2);
    // El KPI cuenta lo mismo que el filtro: el pagado no está.
    expect(result.kpi.pendingPayment).toBe(2);
  });

  it("«Pagados» es exactamente `paid`", async () => {
    const repo = repoWith([
      { id: "sin_cobro", total: 100, paid: 0 },
      { id: "parcial", total: 200, paid: 50 },
      { id: "pagado", total: 300, paid: 300 },
    ]);

    const result = await list(repo, { payment: "paid" });

    expect(result.data.map((entry) => entry.id)).toEqual(["pagado"]);
    expect(result.data[0].financialState.status).toBe("paid");
  });

  it("un parcial con plata no demostrable sigue siendo «Pendiente» y se declara para revisar", async () => {
    const repo = repoWith([{ id: "revisar", total: 100, paid: 60, unresolved: 40 }]);

    const result = await list(repo, { payment: "pending" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].financialState).toEqual({
      status: "partial",
      paidAmount: 60,
      outstandingAmount: 40,
      unresolvedAmount: 40,
      baseCurrencyCode: BASE,
    });
    // El monto no demostrable **no** se convierte con la tasa de hoy: se informa tal como entró.
    expect(result.data[0].financialState.unresolvedAmount).toBe(40);
  });

  it("un cobro anulado no cuenta para el estado financiero", async () => {
    const repo = new RowRepository();
    repo.rows.push(
      row({
        id: "ord_1",
        orderNumber: "P-1",
        total: 100,
        payments: [
          { id: "pay_1", amount: 100, currency: BASE, baseCurrencyCode: BASE, exchangeRate: null, baseAmount: 100, method: "cash", createdAt: "2026-09-30T18:00:00.000Z", voidedAt: null },
          { id: "pay_2", amount: 100, currency: BASE, baseCurrencyCode: BASE, exchangeRate: null, baseAmount: 100, method: "cash", createdAt: "2026-09-30T18:01:00.000Z", voidedAt: "2026-09-30T19:00:00.000Z" },
        ],
      }),
    );

    const result = await list(repo);

    // Cobrado 100 de 100: el anulado no infla el pagado (y el doble de `payments` tampoco lo devuelve).
    expect(result.data[0].financialState.paidAmount).toBe(100);
    expect(result.data[0].financialState.status).toBe("paid");
  });
});

describe("listAdminOrders · programados", () => {
  it("`scheduledOnly` deja sólo los programados", async () => {
    const repo = new RowRepository();
    repo.rows.push(
      row({ id: "asap", orderNumber: "P-1", pickupScheduled: false, pickupTime: "2026-09-30T19:00:00.000Z" }),
      row({ id: "programado", orderNumber: "P-2", pickupScheduled: true, pickupTime: "2026-10-02T18:00:00.000Z" }),
    );

    const result = await list(repo, { scheduledOnly: true });

    expect(result.data.map((entry) => entry.id)).toEqual(["programado"]);
  });
});

describe("listAdminOrders · la proyección es mínima", () => {
  it("la respuesta no lleva token de consulta, GPS, items ni historial", async () => {
    const repo = new RowRepository();
    repo.rows.push(
      row({
        id: "ord_1",
        orderNumber: "P-1",
        // Si una fila llegara con campos de más, la proyección no los puede dejar pasar.
        ...({
          orderLookupTokenHash: "hash-secreto",
          customerLat: 12.13,
          customerLng: -86.25,
          geoAccuracy: 5,
          geoCapturedAt: "2026-09-30T18:00:00.000Z",
          items: [{ id: "item_1", productName: "Hamburguesa" }],
          statusHistory: [{ id: "hist_1", status: "new" }],
        } as unknown as Partial<AdminOrderRow>),
      }),
    );

    const result = await list(repo);
    const serialized = JSON.stringify(result.data);

    for (const forbidden of [
      "orderLookupTokenHash",
      "hash-secreto",
      "customerLat",
      "customerLng",
      "geoAccuracy",
      "geoCapturedAt",
      "items",
      "statusHistory",
      "productName",
    ]) {
      expect(serialized, `el listado no puede serializar «${forbidden}»`).not.toContain(forbidden);
    }
  });

  it("lleva exactamente los campos aprobados", async () => {
    const repo = new RowRepository();
    repo.rows.push(row({ id: "ord_1", orderNumber: "P-1" }));

    const result = await list(repo);

    expect(Object.keys(result.data[0]).sort()).toEqual(
      [
        "currencyCode",
        "customerName",
        "customerWhatsapp",
        "financialState",
        "id",
        "locationName",
        "orderNumber",
        "pickupScheduled",
        "pickupTime",
        "source",
        "stageChangedAt",
        "status",
        "total",
      ].sort(),
    );
  });

  it("resuelve el nombre del local y no rompe si el local ya no existe", async () => {
    const repo = new RowRepository();
    repo.rows.push(
      row({ id: "ord_1", orderNumber: "P-1", locationId: "loc_norte" }),
      row({ id: "ord_2", orderNumber: "P-2", locationId: "loc_fantasma" }),
    );

    const result = await list(repo);

    expect(result.data.find((entry) => entry.id === "ord_1")?.locationName).toBe("Norte");
    expect(result.data.find((entry) => entry.id === "ord_2")?.locationName).toBeNull();
  });

  it("el pedido legacy sin moneda declarada no rompe: la base entra por parámetro", async () => {
    const repo = new RowRepository();
    repo.rows.push(row({ id: "ord_1", orderNumber: "P-1", currencyCode: null }));

    const result = await list(repo);

    // `Order.currencyCode` congela la moneda del pedido (`D-022`); un pedido anterior a la columna no
    // tiene moneda demostrable, así que los montos se informan en la moneda base vigente y el estado se
    // resuelve contra ella — que es lo mismo que hace la factura al no poder demostrar un cobro legacy.
    expect(result.data[0].currencyCode).toBeNull();
    expect(result.data[0].financialState.baseCurrencyCode).toBe(BASE);
  });
});
