import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TASK-101 — carrera de dos altas simultáneas con la misma clave.
 *
 * El doble de memoria no puede reproducir la carrera real (no hay dos conexiones), así que acá se
 * prueba la parte que **sí** es la red de seguridad: cuando el índice único de la base rechaza la
 * segunda escritura con `P2002`, el adaptador devuelve el pedido que ya existe en vez de propagar el
 * error. Sin esto, un doble tap del cliente devolvía un 500 en vez del pedido.
 *
 * Igual que `find-or-create-customer` y `create-reservation`, la detección mira el `code` del error.
 */
const createMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    order: {
      create: createMock,
      findUnique: findUniqueMock,
    },
  }),
}));

const EXISTING_ORDER_ROW = {
  id: "ord_01",
  orderNumber: "P-ABC",
  type: "pickup",
  status: "new",
  locationId: "loc_principal",
  idempotencyKey: "op-abc-123",
  customerName: "Juan Perez",
  customerWhatsapp: "+50588887777",
  customerId: null,
  address: null,
  deliveryNotes: null,
  deliveryFeeStatus: null,
  packagingAmount: 0,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  tipRate: null,
  pickupTime: null,
  pickupScheduled: false,
  pickupNotes: null,
  paymentMethod: "cash",
  paidWithAmount: null,
  pickupPin: "1234",
  tableId: null,
  couponCode: null,
  subtotal: 100,
  discount: 0,
  total: 100,
  deliveryZoneId: null,
  deliveryZone: null,
  customerLat: null,
  customerLng: null,
  geoAccuracy: null,
  geoCapturedAt: null,
  orderLookupTokenHash: null,
  createdAt: new Date("2026-09-14T12:00:00.000Z"),
  updatedAt: new Date("2026-09-14T12:00:00.000Z"),
  items: [],
};

const ORDER_INPUT = {
  type: "pickup" as const,
  locationId: "loc_principal",
  customerName: "Juan Perez",
  customerWhatsapp: "+50588887777",
  items: [],
  orderNumber: "P-ABC",
  subtotal: 100,
  discount: 0,
  packagingAmount: 0,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  total: 100,
  status: "new",
  idempotencyKey: "op-abc-123",
};

describe("PrismaOrderRepository · idempotencia (TASK-101)", () => {
  beforeEach(() => {
    // Sin esto, las llamadas de un test anterior quedan en el historial y el `not.toHaveBeenCalled`
    // falla por algo que no tiene que ver con el caso que se está probando.
    vi.resetAllMocks();
  });

  it("devuelve el pedido existente cuando el índice único rechaza la segunda escritura", async () => {
    createMock.mockRejectedValueOnce({ code: "P2002" });
    findUniqueMock.mockResolvedValueOnce(EXISTING_ORDER_ROW);

    const { PrismaOrderRepository } = await import("./prisma-order-repository");
    const repository = new PrismaOrderRepository();

    const result = await repository.createOrder(ORDER_INPUT, []);

    expect(result.id).toBe("ord_01");
    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: "op-abc-123" } }),
    );
  });

  it("propaga el error si el choque no es de la clave de idempotencia", async () => {
    createMock.mockRejectedValueOnce({ code: "P2002" });
    // La clave no existe: el choque fue por otro índice (por ejemplo `orderNumber`).
    findUniqueMock.mockResolvedValueOnce(null);

    const { PrismaOrderRepository } = await import("./prisma-order-repository");
    const repository = new PrismaOrderRepository();

    await expect(repository.createOrder(ORDER_INPUT, [])).rejects.toMatchObject({ code: "P2002" });
  });

  it("no intenta recuperarse de una carrera cuando el alta no tiene clave", async () => {
    createMock.mockRejectedValueOnce({ code: "P2002" });

    const { PrismaOrderRepository } = await import("./prisma-order-repository");
    const repository = new PrismaOrderRepository();

    await expect(
      repository.createOrder({ ...ORDER_INPUT, idempotencyKey: null }, []),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
