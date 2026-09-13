import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";

import { updateAdminUserLocations } from "./update-admin-user-locations";

const LOCATIONS = [
  createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
  createInMemoryLocation({ id: "loc_sur", name: "Sur" }),
];

function user(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  return {
    id: "user_1",
    name: "Cocina",
    email: "cocina@oneburger.local",
    passwordHash: "hash",
    role: ADMIN_ROLES.kitchen,
    locationIds: [],
    ...overrides,
  };
}

function setup(users: AdminUserRecord[] = [user()]) {
  return {
    repository: new InMemoryAdminAuthRepository(users),
    locationRepository: new InMemoryLocationRepository(LOCATIONS),
  };
}

/**
 * A — asignar sucursales a un usuario del staff.
 *
 * Es el guardado **completo** (como el formulario de locales): lo que se manda es lo que queda.
 * Y valida contra los locales que existen: guardar un id inventado dejaría al usuario viendo
 * una sucursal que no existe.
 */
describe("updateAdminUserLocations", () => {
  it("asigna las sucursales y reemplaza las anteriores", async () => {
    const { repository, locationRepository } = setup([user({ locationIds: ["loc_norte"] })]);

    const result = await updateAdminUserLocations(
      { userId: "user_1", locationIds: ["loc_sur"] },
      { repository, locationRepository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.locationIds).toEqual(["loc_sur"]);

    const stored = await repository.findUserById("user_1");
    expect(stored?.locationIds).toEqual(["loc_sur"]);
  });

  it("acepta varias sucursales, sin repetidos ni vacíos", async () => {
    const { repository, locationRepository } = setup();

    const result = await updateAdminUserLocations(
      { userId: "user_1", locationIds: ["loc_norte", "loc_norte", "", "  ", "loc_sur"] },
      { repository, locationRepository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.locationIds).toEqual(["loc_norte", "loc_sur"]);
  });

  it("vaciar la lista vuelve al usuario a 've todas'", async () => {
    const { repository, locationRepository } = setup([user({ locationIds: ["loc_norte"] })]);

    const result = await updateAdminUserLocations(
      { userId: "user_1", locationIds: [] },
      { repository, locationRepository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.locationIds).toEqual([]);
  });

  it("rechaza una sucursal que no existe, con el campo señalado", async () => {
    const { repository, locationRepository } = setup();

    await expect(
      updateAdminUserLocations(
        { userId: "user_1", locationIds: ["loc_inventado"] },
        { repository, locationRepository, actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
      fields: { locationIds: expect.stringContaining("no existe") },
    });
  });

  it("un rol sin permiso no puede asignar sucursales", async () => {
    const { repository, locationRepository } = setup();

    await expect(
      updateAdminUserLocations(
        { userId: "user_1", locationIds: ["loc_norte"] },
        { repository, locationRepository, actorRole: ADMIN_ROLES.manager },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("un usuario que no existe responde 404", async () => {
    const { repository, locationRepository } = setup();

    await expect(
      updateAdminUserLocations(
        { userId: "user_inexistente", locationIds: ["loc_norte"] },
        { repository, locationRepository, actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
