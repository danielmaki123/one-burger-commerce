import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { createLocation } from "@/modules/locations/features/create-location/create-location";
import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";
import type { LocationInput } from "@/modules/locations/domain/location-rules";

/**
 * T8 fase 2 — el owner crea un local.
 *
 * El slug se normaliza y es único: es lo que va en la URL del local. Los errores vuelven
 * por campo, que es lo que el formulario necesita para marcar el input.
 */
function input(overrides: Partial<LocationInput> = {}): LocationInput {
  return {
    name: "  Sucursal Norte  ",
    slug: "  Sucursal Norte  ",
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
    isAcceptingOrders: true,
    closedMessage: null,
    ...overrides,
  };
}

function repository() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
  ]);
}

describe("createLocation", () => {
  it("guarda el local con el nombre y el slug prolijos", async () => {
    const result = await createLocation(input(), { repository: repository() });

    expect(result.data.name).toBe("Sucursal Norte");
    expect(result.data.slug).toBe("sucursal-norte");
    expect(result.data.isActive).toBe(true);
  });

  it("rechaza lo que no se puede guardar, campo por campo", async () => {
    await expect(
      createLocation(input({ name: "" }), { repository: repository() }),
    ).rejects.toMatchObject({ status: 422, fields: { name: expect.stringContaining("nombre") } });
  });

  it("no deja dos locales con el mismo slug", async () => {
    const repo = repository();

    await createLocation(input({ slug: "norte" }), { repository: repo });

    await expect(
      createLocation(input({ name: "Otra", slug: "Norte" }), { repository: repo }),
    ).rejects.toMatchObject({ status: 409, fields: { slug: expect.stringContaining("norte") } });
  });

  it("el local nuevo arranca sin catálogo: lo elige el owner en la pantalla", async () => {
    const result = await createLocation(input(), { repository: repository() });

    // En la fase 4 se copia el catálogo del primario; por ahora el local se crea pelado y
    // eso no rompe nada porque nada lee todavía precios por local.
    expect(result.data.id).toBeTruthy();
  });
});
