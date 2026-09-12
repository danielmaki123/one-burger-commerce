import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { deleteLocation } from "@/modules/locations/features/delete-location/delete-location";

/**
 * T8 fase 2 — el owner borra un local.
 *
 * Dos reglas que evitan dejar el negocio sin dónde despachar: **no se puede borrar el
 * último local activo** y **no se puede dejar la lista vacía**. Un local apagado sí se
 * puede borrar, pero solo si queda otro activo.
 */
function repository() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 1 }),
    createInMemoryLocation({
      id: "loc_viejo",
      name: "Viejo",
      slug: "viejo",
      sortOrder: 2,
      isActive: false,
    }),
  ]);
}

describe("deleteLocation", () => {
  it("borra un local que no es el último", async () => {
    const repo = repository();

    await deleteLocation("loc_norte", { repository: repo });

    expect(await repo.findLocationById("loc_norte")).toBeNull();
    expect(await repo.listLocations()).toHaveLength(2);
  });

  it("borra un local apagado si queda otro activo", async () => {
    const repo = repository();

    await deleteLocation("loc_viejo", { repository: repo });

    expect(await repo.findLocationById("loc_viejo")).toBeNull();
  });

  it("no deja borrar el último local activo", async () => {
    const repo = new InMemoryLocationRepository([
      createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    ]);

    await expect(deleteLocation("loc_principal", { repository: repo })).rejects.toMatchObject({
      status: 409,
    });
    expect(await repo.listLocations()).toHaveLength(1);
  });

  it("tampoco si el único activo está apagado y queda solo él", async () => {
    const repo = new InMemoryLocationRepository([
      createInMemoryLocation({ id: "loc_apagado", name: "Apagado", isActive: false }),
    ]);

    await expect(deleteLocation("loc_apagado", { repository: repo })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("no encuentra un local que no existe", async () => {
    await expect(deleteLocation("loc_fantasma", { repository: repository() })).rejects.toMatchObject(
      { status: 404 },
    );
  });
});
