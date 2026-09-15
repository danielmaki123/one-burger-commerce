import { describe, expect, it } from "vitest";

import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";

import { ensurePosEnabled } from "./ensure-pos-enabled";

/**
 * TASK-308 — el punto de venta se prende por local.
 *
 * El flag no es una preferencia de pantalla: la API del POS es la que tiene que decir que no. Lo que
 * se fija acá es que un local con el POS apagado, y un local que no existe, **no habilitan** el
 * mostrador (y el motivo dice cuál es el campo, para que la pantalla lo muestre).
 */
describe("ensurePosEnabled", () => {
  const repository = new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
    createInMemoryLocation({ id: "loc_sur", name: "Sur", posEnabled: false }),
  ]);

  it("deja pasar el local con el punto de venta encendido", async () => {
    await expect(
      ensurePosEnabled({ locationId: "loc_norte" }, { repository }),
    ).resolves.toBeUndefined();
  });

  it("rechaza con 403 el local con el punto de venta apagado", async () => {
    await expect(
      ensurePosEnabled({ locationId: "loc_sur" }, { repository }),
    ).rejects.toMatchObject({
      name: "PosError",
      status: 403,
      code: "FORBIDDEN",
      fields: { locationId: expect.stringContaining("apagado") },
    });
  });

  it("un local que no existe tampoco habilita el mostrador", async () => {
    await expect(
      ensurePosEnabled({ locationId: "loc_fantasma" }, { repository }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
