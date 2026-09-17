import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { updateLocation } from "@/modules/locations/features/update-location/update-location";
import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";
import type { LocationInput } from "@/modules/locations/domain/location-rules";

/**
 * T8 fase 2 — el owner edita un local.
 *
 * `isActive` es el interruptor que decide si el local se puede elegir en el checkout, así
 * que apagarlo tiene que ser una operación explícita y no un efecto de guardar otra cosa.
 */
function input(overrides: Partial<LocationInput> = {}): LocationInput {
  return {
    name: "Sucursal Norte",
    slug: "sucursal-norte",
    isActive: true,
    sortOrder: 1,
    addressLine: null,
    city: null,
    addressReference: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    businessHours: DEFAULT_BUSINESS_HOURS,
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    acceptAlertMinutes: 10,
    prepAlertMinutes: 15,
    isAcceptingOrders: true,
    posEnabled: true,
    requireShiftClose: false,
    closedMessage: null,
    ...overrides,
  };
}

function repository() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal", slug: "principal" }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 1 }),
  ]);
}

describe("updateLocation", () => {
  it("no encuentra un local que no existe", async () => {
    await expect(
      updateLocation("loc_fantasma", input(), { repository: repository() }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("cambia los datos del local", async () => {
    const result = await updateLocation(
      "loc_norte",
      input({ name: "Sucursal Sur", slug: "sur", pickupLeadMinutes: 40 }),
      { repository: repository() },
    );

    expect(result.data.name).toBe("Sucursal Sur");
    expect(result.data.slug).toBe("sur");
    expect(result.data.pickupLeadMinutes).toBe(40);
  });

  it("puede apagarlo: deja de ofrecerse sin perder la configuración", async () => {
    const result = await updateLocation("loc_norte", input({ isActive: false }), {
      repository: repository(),
    });

    expect(result.data.isActive).toBe(false);
    expect(result.data.pickupLeadMinutes).toBe(25);
  });

  it("no puede apagar el último local activo (A)", async () => {
    // Es la guarda simétrica del borrado: el negocio necesita al menos un local que se pueda
    // elegir, así que apagar el último dejaría el checkout sin a dónde mandar el pedido.
    const repo = new InMemoryLocationRepository([
      createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", isActive: true }),
      createInMemoryLocation({
        id: "loc_sur",
        name: "Sur",
        slug: "sur",
        isActive: false,
        sortOrder: 1,
      }),
    ]);

    await expect(
      updateLocation("loc_norte", input({ isActive: false }), { repository: repo }),
    ).rejects.toMatchObject({
      status: 409,
      fields: { isActive: expect.stringContaining("único local activo") },
    });

    expect((await repo.findLocationById("loc_norte"))?.isActive).toBe(true);
  });

  it("con otro local activo sí se puede apagar (A)", async () => {
    const result = await updateLocation("loc_norte", input({ isActive: false }), {
      repository: repository(),
    });

    expect(result.data.isActive).toBe(false);
  });

  it("rechaza datos inválidos sin tocar lo guardado", async () => {
    const repo = repository();

    await expect(
      updateLocation("loc_norte", input({ pickupMaxMinutes: 10 }), { repository: repo }),
    ).rejects.toMatchObject({
      status: 422,
      fields: { pickupMaxMinutes: expect.stringContaining("mayor o igual") },
    });

    const stored = await repo.findLocationById("loc_norte");
    expect(stored?.name).toBe("Norte");
  });

  it("no le puede robar el slug a otro local", async () => {
    await expect(
      updateLocation("loc_norte", input({ slug: "principal" }), { repository: repository() }),
    ).rejects.toMatchObject({ status: 409, fields: { slug: expect.any(String) } });
  });

  it("puede guardar sin cambiar el slug", async () => {
    const result = await updateLocation("loc_norte", input({ slug: "norte", city: "Diriamba" }), {
      repository: repository(),
    });

    expect(result.data.city).toBe("Diriamba");
  });
});
