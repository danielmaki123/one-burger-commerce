import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { BusinessSettingsError } from "@/modules/business-settings/domain/business-settings-errors";

const requireAdminSessionMock = vi.fn();
const getBusinessSettingsMock = vi.fn();
const updateBusinessSettingsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/business-settings/adapters/prisma-business-settings-repository", () => ({
  PrismaBusinessSettingsRepository: vi.fn(function () {
    return {};
  }),
}));

vi.mock("@/modules/business-settings/features/get-business-settings/get-business-settings", () => ({
  getBusinessSettings: getBusinessSettingsMock,
}));

const settingsUpdateAuditMock = vi.fn();

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  settingsUpdateAudit: (input: unknown) => settingsUpdateAuditMock(input),
}));

vi.mock(
  "@/modules/business-settings/features/update-business-settings/update-business-settings",
  () => ({
    updateBusinessSettings: updateBusinessSettingsMock,
  }),
);

function sessionWithRole(role: string) {
  return { user: { id: "admin_1", email: "owner@example.com", role } };
}

describe("/api/admin/business-settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getBusinessSettingsMock.mockResolvedValue({ id: "default", name: "One Burger" });
    updateBusinessSettingsMock.mockResolvedValue({ id: "default", name: "Burger Nick" });
  });

  it("rejects anonymous requests", async () => {
    requireAdminSessionMock.mockRejectedValue(
      new AuthError(401, "UNAUTHORIZED", "No hay sesión de admin"),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lets the owner read the configuration", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole(ADMIN_ROLES.owner));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ name: "One Burger" });
  });

  it("rejects a manager who tries to read or write the configuration", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole(ADMIN_ROLES.manager));

    const { GET, PUT } = await import("./route");
    const read = await GET();
    const write = await PUT(
      new Request("http://localhost/api/admin/business-settings", {
        method: "PUT",
        body: JSON.stringify({ name: "Burger Nick" }),
      }),
    );

    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(updateBusinessSettingsMock).not.toHaveBeenCalled();
    expect(settingsUpdateAuditMock).not.toHaveBeenCalled();
  });

  it("saves the configuration and audits who changed it", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole(ADMIN_ROLES.owner));

    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/admin/business-settings", {
        method: "PUT",
        body: JSON.stringify({ name: "Burger Nick", tipRate: 15 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateBusinessSettingsMock).toHaveBeenCalledWith(
      { name: "Burger Nick", tipRate: 15 },
      expect.objectContaining({ updatedByUserId: "admin_1" }),
    );
    // Bloque 13.1: cambiar la personalización del negocio queda en el log de acciones sensibles.
    expect(settingsUpdateAuditMock).toHaveBeenCalledWith({ actorUserId: "admin_1" });
  });

  it("una configuración rechazada por el caso de uso no se firma", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole(ADMIN_ROLES.owner));
    updateBusinessSettingsMock.mockRejectedValue(
      new BusinessSettingsError(422, "VALIDATION_ERROR", "La configuración tiene errores"),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/admin/business-settings", {
        method: "PUT",
        body: JSON.stringify({ primaryColor: "azul" }),
      }),
    );

    expect(response.status).toBe(422);
    expect(settingsUpdateAuditMock).not.toHaveBeenCalled();
  });

  it("maps a validation failure to a 422 with the offending fields", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole(ADMIN_ROLES.owner));
    updateBusinessSettingsMock.mockRejectedValue(
      new BusinessSettingsError(422, "VALIDATION_ERROR", "La configuración tiene errores", {
        primaryColor: "Usá un hex de 6 dígitos",
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/admin/business-settings", {
        method: "PUT",
        body: JSON.stringify({ primaryColor: "azul" }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR", fields: { primaryColor: expect.any(String) } },
    });
  });

  it("rejects a body that is not JSON", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole(ADMIN_ROLES.owner));

    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/admin/business-settings", {
        method: "PUT",
        body: "no soy json",
      }),
    );

    expect(response.status).toBe(400);
    expect(updateBusinessSettingsMock).not.toHaveBeenCalled();
  });
});
