import { describe, expect, it } from "vitest";

import { InMemoryLocationRepository, createInMemoryLocation } from "@/modules/locations/adapters/in-memory-location-repository";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";

import { createOrder as createOrderFeature } from "./create-order";

/**
 * TASK-101 — idempotencia del alta.
 *
 * El alta pública no tiene sesión ni clave de operación: `orderNumber` se genera con el reloj, así
 * que un reintento del mismo request (doble tap, red que se corta y el cliente reintenta) creaba
 * **otro pedido**. Acá se fija el contrato: un `idempotencyKey` repetido devuelve el pedido que ya
 * existe.
 *
 * El doble de test implementa el puerto completo, así que el compilador obliga a que el adaptador
 * de memoria y el de Prisma tengan la misma regla.
 */
function defaultLocationRepository(): LocationRepository {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
  ]);
}

type CreateOrderDeps = Parameters<typeof createOrderFeature>[1];

const createOrder = (
  input: Parameters<typeof createOrderFeature>[0],
  deps: Omit<CreateOrderDeps, "locationRepository"> & { locationRepository?: LocationRepository },
) => {
  const { locationRepository = defaultLocationRepository(), ...rest } = deps;

  return createOrderFeature(input, { ...rest, locationRepository });
};

function seedProduct(repository: InMemoryOrderRepository) {
  repository.products.push({
    id: "prod_01",
    name: "Cafe",
    basePrice: 100,
    packagingFeeAmount: null,
    categoryId: "cat_01",
    subcategoryId: null,
    isActive: true,
    isAvailable: true,
    modifierGroups: [],
  });
}

function buildInput(idempotencyKey?: string) {
  return {
    type: "pickup" as const,
    customerName: "Juan Perez",
    customerWhatsapp: "+50588887777",
    items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
    idempotencyKey,
  };
}

describe("createOrder · idempotencia (TASK-101)", () => {
  it("dos altas con el mismo idempotencyKey crean un solo pedido", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    const first = await createOrder(buildInput("op-abc-123"), { repository });
    const second = await createOrder(buildInput("op-abc-123"), { repository });

    expect(repository.orders).toHaveLength(1);
    expect(second.data.id).toBe(first.data.id);
    // El reintento no reemite el token en claro (solo se conoce al crear). Lo que no puede
    // pasar es que se invente uno nuevo: el hash guardado es del primero.
    expect(second.data.orderLookupToken).toBeNull();
  });

  it("dos altas sin idempotencyKey crean dos pedidos", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    await createOrder(buildInput(), { repository });
    await createOrder(buildInput(), { repository });

    expect(repository.orders).toHaveLength(2);
  });

  it("dos altas con claves distintas crean dos pedidos", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    await createOrder(buildInput("op-1"), { repository });
    await createOrder(buildInput("op-2"), { repository });

    expect(repository.orders).toHaveLength(2);
  });

  it("marca el reintento en meta para que la ruta responda 200 en vez de 201", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    const first = await createOrder(buildInput("op-abc-123"), { repository });
    const second = await createOrder(buildInput("op-abc-123"), { repository });

    expect(first.meta.reused).toBe(false);
    expect(second.meta.reused).toBe(true);
    expect(first.meta.sourceOfTruth).toBe("backend");
  });

  it("guarda la clave en el pedido creado", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    const result = await createOrder(buildInput("op-abc-123"), { repository });

    expect(result.data.idempotencyKey).toBe("op-abc-123");
  });

  it("busca por la clave ya guardada", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    const result = await createOrder(buildInput("op-abc-123"), { repository });
    const found = await repository.findOrderByIdempotencyKey("op-abc-123");

    expect(found?.id).toBe(result.data.id);
    expect(await repository.findOrderByIdempotencyKey("no-existe")).toBeNull();
  });

  it("ignora un idempotencyKey vacío o en blanco", async () => {
    const repository = new InMemoryOrderRepository();
    seedProduct(repository);

    await createOrder(buildInput(""), { repository });
    await createOrder(buildInput(""), { repository });

    expect(repository.orders).toHaveLength(2);
    expect(repository.orders[0].idempotencyKey).toBeNull();
  });
});
