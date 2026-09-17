// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettingsRecord,
} from "@/modules/notifications/domain/notification-settings";

import NotificationsClient from "./notifications-client";

/**
 * Decisión del owner (2026-09-17) — la pantalla de **alertas rediseñada**.
 *
 * Lo que fijan estos casos es lo que el owner pidió como criterio de aceptación: los avisos se prenden con
 * **interruptores** que guardan al toque, el **umbral de devoluciones solo aparece si ese aviso está
 * prendido**, «Guardar» está apagado mientras no haya cambios, el estado muestra el **bot** y el
 * **último envío**, y el historial dice qué salió y qué no. La lógica de envío no se toca: la pantalla lee
 * y escribe la misma configuración de siempre.
 */

const settings: NotificationSettingsRecord = {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  chatId: "-5186519063",
  enabled: true,
  eventsEnabled: ["shift_closed"],
  refundAlertThreshold: 500,
  lastSentAt: "2026-09-17T17:55:00.000Z",
  updatedAt: new Date("2026-09-17T12:00:00.000Z").toISOString(),
};

const history = [
  {
    id: "evt_2",
    label: "Cierre de caja",
    locationName: "Camino de Oriente",
    at: "2026-09-17T17:55:00.000Z",
    ok: true,
    errorMessage: null,
  },
  {
    id: "evt_1",
    label: "Devolución grande",
    locationName: null,
    at: "2026-09-17T15:00:00.000Z",
    ok: false,
    errorMessage: "Telegram rechazó el mensaje.",
  },
];

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
      if (url === "/api/admin/settings/notifications/test") {
        return jsonResponse({ data: { status: "conectado" } });
      }
      if (url === "/api/admin/settings/notifications" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse({ data: { ...settings, ...body } });
      }
      return jsonResponse({ data: settings });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderPanel(overrides: Partial<React.ComponentProps<typeof NotificationsClient>> = {}) {
    return render(
      <NotificationsClient
        initialSettings={settings}
        tokenConfigured
        botUsername="humbalertbot"
        history={history}
        {...overrides}
      />,
    );
  }

  it("el estado muestra el chat, el bot y el último envío", () => {
    renderPanel();

    const estado = screen.getByRole("region", { name: "Estado de las alertas" });

    expect(estado.textContent).toContain("Conectado");
    expect(estado.textContent).toContain("-5186519063");
    expect(estado.textContent).toContain("@humbalertbot");
    expect(estado.textContent).toContain("Último envío");
  });

  it("sin configurar ofrece «Configurar» en vez de probar la conexión", () => {
    renderPanel({ initialSettings: { ...settings, chatId: null } });

    const estado = screen.getByRole("region", { name: "Estado de las alertas" });

    expect(estado.textContent).toContain("Sin configurar");
    expect(within(estado).getByRole("button", { name: "Configurar" })).toBeTruthy();
    expect(within(estado).queryByRole("button", { name: "Probar conexión" })).toBeNull();
  });

  it("los eventos se prenden con interruptores y guardan al toque", async () => {
    const user = userEvent.setup();
    renderPanel();

    const eventos = screen.getByRole("region", { name: "Eventos que se avisan" });
    const interruptores = within(eventos).getAllByRole("switch");

    expect(interruptores).toHaveLength(3);
    // Cierre de caja viene prendido; los otros dos, apagados.
    expect(interruptores[0]?.getAttribute("aria-checked")).toBe("true");
    expect(interruptores[1]?.getAttribute("aria-checked")).toBe("false");

    await user.click(within(eventos).getByRole("switch", { name: "Avisar: Turno sin cerrar >24 h" }));

    const patch = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/admin/settings/notifications" && init?.method === "PATCH",
    );
    expect(JSON.parse(String((patch?.[1] as RequestInit).body)).eventsEnabled).toEqual([
      "shift_closed",
      "shift_open_over_24h",
    ]);
    expect(await screen.findByText("Guardado")).toBeTruthy();
  });

  it("el umbral de devoluciones solo aparece si ese aviso está prendido", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByLabelText(/Devolución mayor a/)).toBeNull();

    await user.click(screen.getByRole("switch", { name: "Avisar: Devolución grande" }));

    expect(screen.getByLabelText(/Devolución mayor a/)).toBeTruthy();
  });

  it("«Guardar y activar» está apagado mientras no haya cambios", async () => {
    const user = userEvent.setup();
    renderPanel();

    const guardar = screen.getByRole("button", { name: "Guardar y activar" });
    expect((guardar as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Chat ID"), "9");

    expect((screen.getByRole("button", { name: "Guardar y activar" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("«Probar conexión» manda un mensaje real y lo avisa", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Probar conexión" }));

    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input) === "/api/admin/settings/notifications/test" && init?.method === "POST",
      ),
    ).toBe(true);
    expect(await screen.findByText(/Mensaje de prueba enviado/)).toBeTruthy();
  });

  it("el historial dice qué salió y qué no, con su sucursal", () => {
    renderPanel();

    const historial = screen.getByRole("region", { name: "Historial de envíos" });

    expect(historial.textContent).toContain("Cierre de caja");
    expect(historial.textContent).toContain("Camino de Oriente");
    expect(historial.textContent).toContain("Enviado");
    expect(historial.textContent).toContain("No salió");
  });

  it("sin envíos lo dice, en vez de una lista vacía", () => {
    renderPanel({ history: [] });

    expect(screen.getByText(/Todavía no salió ningún aviso/)).toBeTruthy();
  });

  it("no quedó ningún enlace a Personalización", () => {
    renderPanel();

    expect(screen.queryByRole("link", { name: /Volver a Personalización/ })).toBeNull();
  });
});
