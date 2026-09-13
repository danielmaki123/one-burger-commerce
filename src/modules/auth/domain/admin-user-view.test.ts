import { describe, expect, it } from "vitest";

import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";

import { toAuthenticatedAdminUser } from "./admin-user-view";

function record(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  return {
    id: "user_1",
    name: "Cocina",
    email: "cocina@oneburger.local",
    passwordHash: "scrypt$65536$8$2$sal$digest",
    role: ADMIN_ROLES.kitchen,
    locationIds: [],
    ...overrides,
  };
}

describe("toAuthenticatedAdminUser", () => {
  it("no deja salir el hash de la contraseña", () => {
    const view = toAuthenticatedAdminUser(record());

    expect(view).not.toHaveProperty("passwordHash");
    expect(Object.keys(view).sort()).toEqual(["email", "id", "locationIds", "name", "role"]);
  });

  it("lleva las sucursales asignadas (el alcance de pedidos las necesita)", () => {
    const view = toAuthenticatedAdminUser(record({ locationIds: ["loc_norte", "loc_sur"] }));

    expect(view.locationIds).toEqual(["loc_norte", "loc_sur"]);
  });
});
