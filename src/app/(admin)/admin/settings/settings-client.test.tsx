// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import AdminSettingsClientPage from "./settings-client";

function inputValue(element: HTMLElement) {
  return (element as HTMLInputElement).value;
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

function initialSettings() {
  const record = createDefaultBusinessSettingsRecord();

  return { ...record, updatedAt: record.updatedAt.toISOString() };
}

describe("AdminSettingsClientPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => jsonResponse(initialSettings()));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("precarga la configuración guardada", () => {
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    expect(inputValue(screen.getByLabelText("Nombre *"))).toBe("One Burger");
    expect(inputValue(screen.getByLabelText("WhatsApp"))).toBe("50588770888");
    expect(inputValue(screen.getByLabelText(/Propina sugerida/))).toBe("10");
  });

  it("manda el formulario completo con el nombre editado", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    const nameInput = screen.getByLabelText("Nombre *");
    await user.clear(nameInput);
    await user.type(nameInput, "Burger Nick");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/business-settings");
    expect(init.method).toBe("PUT");

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.name).toBe("Burger Nick");
    // El formulario manda la configuración completa, no un parche parcial.
    expect(body.businessHours).toMatchObject({
      mon: { closed: false, open: "12:00", close: "22:00" },
    });
    expect(body.tipRate).toBe(10);
  });

  it("muestra el error por campo que devuelve la API sin perder lo editado", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "La configuración tiene errores de validación",
            fields: { whatsapp: "Usá formato E.164 sin +, por ejemplo 50588770888" },
          },
        },
        false,
      ),
    );

    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    const whatsappInput = screen.getByLabelText("WhatsApp");
    await user.clear(whatsappInput);
    await user.type(whatsappInput, "+50588770888");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Usá formato E.164 sin +, por ejemplo 50588770888"),
    ).toBeTruthy();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(inputValue(screen.getByLabelText("WhatsApp"))).toBe("+50588770888");
  });

  it("permite restablecer un campo al valor guardado", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    const nameInput = screen.getByLabelText("Nombre *");
    await user.clear(nameInput);
    await user.type(nameInput, "Otro nombre");
    expect(inputValue(nameInput)).toBe("Otro nombre");

    const resetButtons = screen.getAllByRole("button", { name: "Restablecer" });
    await user.click(resetButtons[0]);

    expect(inputValue(screen.getByLabelText("Nombre *"))).toBe("One Burger");
  });

  it("marca el día cerrado sin romper el resto de la semana", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    await user.click(screen.getByLabelText("Cerrado", { selector: "#hours-sun-closed" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { businessHours: Record<string, { closed: boolean }> };

    expect(body.businessHours.sun.closed).toBe(true);
    expect(body.businessHours.mon.closed).toBe(false);
  });
});
