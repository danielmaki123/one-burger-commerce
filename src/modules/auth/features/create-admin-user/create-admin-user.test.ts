import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { verifyPassword } from "@/shared/lib/auth/password-hasher";

import { createAdminUser } from "./create-admin-user";

const LOCATIONS = [
  createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
  createInMemoryLocation({ id: "loc_sur", name: "Sur" }),
];

function createRepository(existing: AdminUserRecord[] = []) {
  return new InMemoryAdminAuthRepository(existing);
}

function locationRepository() {
  return new InMemoryLocationRepository(LOCATIONS);
}

describe("createAdminUser", () => {
  it("creates a manager user when actor is owner", async () => {
    const repository = createRepository();

    const result = await createAdminUser(
      {
        name: "Turno",
        email: "turno@oneburger.local",
        password: "Admin1234!",
        role: ADMIN_ROLES.manager,
      },
      { repository, locationRepository: locationRepository(), actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.email).toBe("turno@oneburger.local");
    expect(result.data.role).toBe(ADMIN_ROLES.manager);
    expect(result.data).not.toHaveProperty("passwordHash");

    const stored = await repository.findUserByEmail("turno@oneburger.local");
    expect(stored).not.toBeNull();
    expect(verifyPassword("Admin1234!", stored?.passwordHash ?? "")).toBe(true);
  });

  it("crea el usuario con las sucursales asignadas (A)", async () => {
    const repository = createRepository();

    const result = await createAdminUser(
      {
        name: "Cocina Norte",
        email: "norte@oneburger.local",
        password: "Admin1234!",
        role: ADMIN_ROLES.kitchen,
        locationIds: ["loc_norte"],
      },
      { repository, locationRepository: locationRepository(), actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.locationIds).toEqual(["loc_norte"]);
    expect((await repository.findUserById(result.data.id))?.locationIds).toEqual(["loc_norte"]);
  });

  it("sin sucursales el usuario queda viendo todas (lista vacía)", async () => {
    const repository = createRepository();

    const result = await createAdminUser(
      {
        name: "Sin asignar",
        email: "sin-asignar@oneburger.local",
        password: "Admin1234!",
        role: ADMIN_ROLES.kitchen,
      },
      { repository, locationRepository: locationRepository(), actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.locationIds).toEqual([]);
  });

  it("rechaza una sucursal que no existe, sin crear el usuario", async () => {
    const repository = createRepository();

    await expect(
      createAdminUser(
        {
          name: "Fantasma",
          email: "fantasma@oneburger.local",
          password: "Admin1234!",
          role: ADMIN_ROLES.kitchen,
          locationIds: ["loc_inventado"],
        },
        { repository, locationRepository: locationRepository(), actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
      fields: { locationIds: expect.stringContaining("no existe") },
    });

    expect(await repository.findUserByEmail("fantasma@oneburger.local")).toBeNull();
  });

  it.each([ADMIN_ROLES.manager, ADMIN_ROLES.kitchen] as AdminRole[])(
    "forbids %s from creating users",
    async (actorRole) => {
      await expect(
        createAdminUser(
          {
            name: "Cocina",
            email: "cocina@oneburger.local",
            password: "Admin1234!",
            role: ADMIN_ROLES.kitchen,
          },
          {
            repository: createRepository(),
            locationRepository: locationRepository(),
            actorRole,
          },
        ),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    },
  );

  it("rejects duplicate emails", async () => {
    const repository = createRepository([
      {
        id: "user_1",
        name: "Owner",
        email: "owner@oneburger.local",
        passwordHash: "hash",
        role: ADMIN_ROLES.owner,
        locationIds: [],
      },
    ]);

    await expect(
      createAdminUser(
        {
          name: "Owner Copy",
          email: "owner@oneburger.local",
          password: "Admin1234!",
          role: ADMIN_ROLES.manager,
        },
        { repository, locationRepository: locationRepository(), actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
