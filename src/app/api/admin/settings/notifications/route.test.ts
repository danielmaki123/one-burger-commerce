import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { NotificationSettingsError } from "@/modules/notifications/domain/notification-settings-errors";

/**
 * Parte 3 del brief (alertas Telegram) — las dos rutas de configuración.
 *
 * Fija las tres reglas duras del brief: **solo el owner** configura y prueba; el **token no se expone**
 * (el GET solo dice si está puesto en el servidor); y un envío fallido trae el motivo específico, no un
 * error genérico.
 */

const requireAdminSessionMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

const getMock = vi.fn();
const saveMock = vi.fn();
const recordSendResultMock = vi.fn();

vi.mock("@/modules/notifications/adapters/prisma-notification-settings-repository", () => ({
  PrismaNotificationSettingsRepository: class {
    get() {
      return getMock();
    }
    save(input: unknown) {
      return saveMock(input);
    }
    recordSendResult(input: unknown) {
      return recordSendResultMock(input);
    }
  },
}));

const sendMessageMock = vi.fn();

vi.mock("@/modules/notifications/adapters/telegram-http-gateway", () => ({
  TelegramHttpGateway: class {
    sendMessage(input: unknown) {
      return sendMessageMock(input);
    }
  },
}));

const defaults = {
  chatId: null,
  enabled: false,
  eventsEnabled: [],
  refundAlertThreshold: 500,
  differenceAlertThreshold: null,
  lastSentAt: null,
  lastError: null,
  updatedAt: new Date(0).toISOString(),
};

function sessionWithRole(role: string) {
  return { user: { id: "admin_1", role, locationIds: [] } };
}

function patch(body: unknown) {
  return new Request("http://localhost/api/admin/settings/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/settings/notifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue(sessionWithRole("owner"));
    getMock.mockResolvedValue({ ...defaults });
    saveMock.mockImplementation(async (input: unknown) => ({ ...defaults, ...(input as object) }));
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
  });

  it("devuelve la configuración y si el servidor tiene el token (sin exponerlo)", async () => {
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.chatId).toBeNull();
    expect(body.meta.tokenConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("123:ABC");
  });

  it("sin token en el servidor lo dice (para que la pantalla no prometa nada)", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    const { GET } = await import("./route");
    const body = await (await GET()).json();

    expect(body.meta.tokenConfigured).toBe(false);
  });

  it("el manager no configura las alertas: 403", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole("manager"));

    const { PATCH } = await import("./route");
    const response = await PATCH(patch({ chatId: "-1001234567890" }));

    expect(response.status).toBe(403);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("guarda el chat y los eventos, y limpia lo que no es un evento conocido", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(
      patch({ chatId: "-1001234567890", enabled: true, eventsEnabled: ["refund_over_threshold", "x"] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.eventsEnabled).toEqual(["refund_over_threshold"]);
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "-1001234567890", enabled: true }),
    );
  });

  it("un chat inválido responde 422 con el campo", async () => {
    const { PATCH } = await import("./route");

    const response = await PATCH(patch({ chatId: "mi grupo" }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.chatId).toBeTruthy();
  });

  it("sin sesión responde 401", async () => {
    requireAdminSessionMock.mockRejectedValue(
      new AuthError(401, "UNAUTHORIZED", "No hay sesión de admin"),
    );

    const { GET } = await import("./route");

    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/admin/settings/notifications/test", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue(sessionWithRole("owner"));
    getMock.mockResolvedValue({ ...defaults, chatId: "-1001234567890" });
  });

  it("manda un mensaje real y anota el envío", async () => {
    sendMessageMock.mockResolvedValue({ ok: true });

    const { POST } = await import("./test/route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("conectado");
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(recordSendResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ sentAt: expect.any(String), error: null }),
    );
  });

  it("si Telegram rechaza el chat, la respuesta trae el motivo específico y guarda el error", async () => {
    sendMessageMock.mockResolvedValue({ ok: false, reason: "chat-invalid", detail: "chat not found" });

    const { POST } = await import("./test/route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.message).toContain("chat_id no existe");
    expect(recordSendResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("chat_id no existe") }),
    );
  });

  it("sin chat configurado no llama a Telegram: 422", async () => {
    getMock.mockResolvedValue({ ...defaults, chatId: null });

    const { POST } = await import("./test/route");
    const response = await POST();

    expect(response.status).toBe(422);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("solo el owner puede probar: 403", async () => {
    requireAdminSessionMock.mockResolvedValue(sessionWithRole("cashier"));

    const { POST } = await import("./test/route");

    expect((await POST()).status).toBe(403);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("un error de dominio de configuración se mapea con su status", async () => {
    getMock.mockRejectedValue(new NotificationSettingsError(422, "VALIDATION_ERROR", "Revisá."));

    const { POST } = await import("./test/route");

    expect((await POST()).status).toBe(422);
  });
});
