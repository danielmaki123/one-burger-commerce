// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettingsRecord,
} from "@/modules/notifications/domain/notification-settings";

import NotificationsClient from "./notifications-client";

/**
 * Parte 3 del brief (alertas Telegram) — la pantalla donde el owner configura su grupo.
 *
 * El caso que puede salir caro es el de la configuración: el `chat_id` y los eventos se guardan con
 * `PATCH`, y «Probar conexión» **manda un mensaje real** —si falla, la pantalla tiene que decir el motivo
 * (chat inválido, bot fuera del grupo, token del servidor) y no un «no se pudo»—. Estos casos fijan las
 * llamadas que salen y lo que el owner lee.
 */

const settings: NotificationSettingsRecord = {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  chatId: "-5186519063",
  enabled: true,
  eventsEnabled: ["shift_open_over_24h"],
  refundAlertThreshold: 500,
  updatedAt: new Date("2026-09-17T12:00:00.000Z").toISOString(),
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("NotificationsClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/settings/notifications/test") return jsonResponse({ data: { status: "conectado" } });
      if (url === "/api/admin/settings/notifications" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse({ data: { ...settings, ...body, updatedAt: settings.updatedAt } });
      }
      return jsonResponse({ data: settings });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra el estado y el último envío", () => {
    render(<NotificationsClient initialSettings={settings} tokenConfigured />);

    const estado = screen.getByRole("region", { name: "Estado de las alertas" });
    expect(estado.textContent).toContain("Conectado");
    expect(estado.textContent).toContain("Último envío");
  });

  it("sin token en el servidor lo dice: no es algo que el owner arregle desde acá", () => {
    render(<NotificationsClient initialSettings={settings} tokenConfigured={false} />);

    const estado = screen.getByRole("region", { name: "Estado de las alertas" });
    expect(estado.textContent).toContain("Falta el token en el servidor");
    expect(estado.textContent).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("«Guardar y activar» manda el chat y prende las alertas", async () => {
    const user = userEvent.setup();
    render(<NotificationsClient initialSettings={{ ...settings, enabled: false }} tokenConfigured />);

    await user.click(screen.getByRole("button", { name: "Guardar y activar" }));

    const patch = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/admin/settings/notifications" && init?.method === "PATCH",
    );
    const body = JSON.parse(String((patch?.[1] as RequestInit).body));
    expect(body).toMatchObject({ chatId: "-5186519063", enabled: true });
    expect(await screen.findByText("Guardado.")).toBeTruthy();
  });

  it("«Probar conexión» manda un mensaje real y lo avisa", async () => {
    const user = userEvent.setup();
    render(<NotificationsClient initialSettings={settings} tokenConfigured />);

    await user.click(screen.getByRole("button", { name: "Probar conexión" }));

    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input) === "/api/admin/settings/notifications/test" && init?.method === "POST",
      ),
    ).toBe(true);
    expect(await screen.findByText(/Mensaje de prueba enviado/)).toBeTruthy();
  });

  it("si la prueba falla dice el motivo que devolvió el servidor", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/settings/notifications/test") {
        return jsonResponse(
          { error: { message: "El bot no está en el grupo: agregalo y volvé a probar." } },
          502,
        );
      }
      if (url === "/api/admin/settings/notifications" && init?.method === "PATCH") {
        return jsonResponse({ data: { ...settings, lastError: "bot-not-in-chat" } });
      }
      return jsonResponse({ data: settings });
    });
    const user = userEvent.setup();
    render(<NotificationsClient initialSettings={settings} tokenConfigured />);

    await user.click(screen.getByRole("button", { name: "Probar conexión" }));

    // El motivo sale en dos lugares a propósito: el aviso de la sección y el campo del chat (que es lo
    // que hay que arreglar). Alcanza con que el motivo esté, sin inventar un «no se pudo».
    const avisos = await screen.findAllByRole("alert");
    expect(avisos.map((nodo) => nodo.textContent).join(" · ")).toContain(
      "El bot no está en el grupo",
    );
  });

  it("prender un evento lo guarda y «Desactivar alertas» las apaga", async () => {
    const user = userEvent.setup();
    render(<NotificationsClient initialSettings={settings} tokenConfigured />);

    await user.click(screen.getByLabelText("Avisar: Devolución grande"));

    const eventos = fetchMock.mock.calls
      .filter(
        ([input, init]) =>
          String(input) === "/api/admin/settings/notifications" && init?.method === "PATCH",
      )
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).eventsEnabled);

    expect(eventos.at(-1)).toEqual(["shift_open_over_24h", "refund_over_threshold"]);

    await user.click(screen.getByRole("button", { name: "Desactivar alertas" }));

    const apagado = fetchMock.mock.calls
      .filter(
        ([input, init]) =>
          String(input) === "/api/admin/settings/notifications" && init?.method === "PATCH",
      )
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).enabled);

    expect(apagado.at(-1)).toBe(false);
  });
});
