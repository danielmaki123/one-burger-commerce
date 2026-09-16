import { describe, expect, it } from "vitest";

import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";

import { roleOptionFor, ROLE_OPTIONS } from "./user-role-options";

describe("user role options", () => {
  it("cubre todos los roles del enum (un rol sin opción se muestra mal en la fila)", () => {
    // El bug que esto evita: con `cashier` fuera de la lista, su fila mostraba el chip de otro rol y
    // el selector quedaba con un valor sin opción.
    for (const role of Object.values(ADMIN_ROLES)) {
      expect(
        ROLE_OPTIONS.some((option) => option.value === role),
        `falta la opción del rol ${role}`,
      ).toBe(true);
      expect(roleOptionFor(role).value).toBe(role);
    }
  });

  it("cada opción explica qué puede hacer el rol", () => {
    for (const option of ROLE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(2);
      expect(option.detail.length).toBeGreaterThan(10);
    }
  });

  it("un rol desconocido no se disfraza de otro", () => {
    // Si algún día entra un rol nuevo, la fila dice su valor crudo en vez de mentir con "Gerente".
    const unknown = roleOptionFor("unknown" as never);

    expect(unknown.label).toBe("unknown");
    expect(unknown.value).toBe("unknown");
  });
});
