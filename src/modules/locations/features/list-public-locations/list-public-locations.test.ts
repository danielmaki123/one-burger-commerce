import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { listPublicLocations } from "@/modules/locations/features/list-public-locations/list-public-locations";

/**
 * T8 fase 6 — los locales que ve el cliente en el checkout.
 *
 * Solo los activos, ordenados como los ordena el admin, y **solo los datos del punto de
 * retiro**: dirección, mapa, horario y si están recibiendo pedidos. El teléfono del local,
 * el WhatsApp interno y la auditoría no salen a la calle.
 */
function repository() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal", sortOrder: 0 }),
    createInMemoryLocation({
      id: "loc_apagado",
      name: "Apagado",
      slug: "apagado",
      sortOrder: 1,
      isActive: false,
    }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 2 }),
  ]);
}

describe("listPublicLocations", () => {
  it("ofrece solo los locales activos, en el orden del admin", async () => {
    const result = await listPublicLocations({ repository: repository() });

    expect(result.data.map((location) => location.id)).toEqual(["loc_principal", "loc_norte"]);
  });

  it("no expone datos internos del local", async () => {
    const result = await listPublicLocations({ repository: repository() });

    expect(Object.keys(result.data[0]).sort()).toEqual([
      "addressLine",
      "addressReference",
      "businessHours",
      "city",
      "closedMessage",
      "id",
      "isAcceptingOrders",
      "mapsUrl",
      "name",
      "pickupLeadMinutes",
      "pickupMaxMinutes",
    ]);
  });

  it("lleva lo que el checkout necesita para calcular el retiro", async () => {
    const result = await listPublicLocations({ repository: repository() });

    expect(result.data[0]).toMatchObject({
      name: "Principal",
      pickupLeadMinutes: 25,
      isAcceptingOrders: true,
    });
    // El horario completo: los turnos se calculan en el navegador con el del local elegido.
    expect(Object.keys(result.data[0].businessHours)).toHaveLength(7);
  });

  it("sin locales activos devuelve una lista vacía, no un error", async () => {
    const result = await listPublicLocations({
      repository: new InMemoryLocationRepository([
        createInMemoryLocation({ id: "loc_1", name: "Uno", isActive: false }),
      ]),
    });

    expect(result.data).toEqual([]);
  });
});
