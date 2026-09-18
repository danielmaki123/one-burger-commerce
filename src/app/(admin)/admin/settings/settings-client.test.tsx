// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

  it("no edita los horarios acá: los manda como están y apunta a Locales", async () => {
    // El horario es por sucursal (`Location.businessHours`) y el checkout usa el del local elegido.
    // Esta pantalla ya no ofrece el editor: solo recuerda dónde se carga. Lo guardado sigue viajando
    // como respaldo para el caso de un negocio sin locales.
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    expect(screen.queryByLabelText("Cerrado", { selector: "#hours-sun-closed" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Locales" })[0]?.getAttribute("href")).toBe(
      "/admin/locations",
    );

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { businessHours: Record<string, { closed: boolean }> };

    expect(Object.keys(body.businessHours)).toHaveLength(7);
    expect(body.businessHours.sun.closed).toBe(false);
  });

  it("aplicar un preset cambia los colores y viaja en el payload", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    expect(inputValue(screen.getByLabelText("Color de marca en hexadecimal"))).toBe("#2b6c96");

    await user.click(screen.getByRole("button", { name: /Brasa/ }));

    expect(inputValue(screen.getByLabelText("Color de marca en hexadecimal"))).toBe("#a8321f");
    expect(screen.getByText(/cumplen el contraste mínimo/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;

    expect(body.primaryColor).toBe("#a8321f");
    expect(body.accentColor).toBe("#f7e6e0");
  });

  it("ofrece las tres tipografías con su nombre real y previsualiza la elegida", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    const heading = screen.getByLabelText("Tipografía de títulos") as HTMLSelectElement;
    const body = screen.getByLabelText("Tipografía de texto") as HTMLSelectElement;
    const expected = [
      { value: "fraunces", label: "Fraunces" },
      { value: "inter", label: "Inter" },
      { value: "jakarta", label: "Plus Jakarta Sans" },
    ];

    for (const select of [heading, body]) {
      expect(
        Array.from(select.options).map((option) => ({
          value: option.value,
          label: option.textContent,
        })),
      ).toEqual(expected);
    }

    await user.selectOptions(heading, "jakarta");

    // La vista previa tiene que mostrar la tipografía elegida: con una lista
    // fija de dos, la tercera se veía como Inter.
    const preview = screen.getByLabelText("Vista previa");
    const brandName = within(preview).getByText("One Burger");
    expect(brandName.style.fontFamily).toBe("var(--font-jakarta)");

    await user.selectOptions(body, "jakarta");
    expect(screen.getByLabelText("Vista previa")).toBeTruthy();
  });

  it("manda el rango de preparación y lo vacía a null (T5)", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    const maxInput = screen.getByLabelText(/Máximo del rango/);
    // Sin rango configurado el campo arranca vacío, no en 0.
    expect(inputValue(maxInput)).toBe("");

    await user.type(maxInput, "40");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const withRange = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;
    expect(withRange.pickupMaxMinutes).toBe(40);

    await user.clear(screen.getByLabelText(/Máximo del rango/));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const withoutRange = JSON.parse(
      String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;
    expect(withoutRange.pickupMaxMinutes).toBeNull();
  });

  it("la vista previa sigue los minutos que estás escribiendo (fase 2)", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    // Con la configuración por defecto (cierre 22:00 y 25 minutos de preparación), la
    // última orden entra 21:35. Es el dato que hoy no se veía en ningún lado.
    expect(await screen.findByText("9:35 p. m.")).toBeTruthy();

    const leadInput = screen.getByLabelText("Minutos de preparación");
    await user.clear(leadInput);
    await user.type(leadInput, "40");

    // 40 minutos antes del cierre: 21:20. Sin guardar nada.
    expect(await screen.findByText("9:20 p. m.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("avisa del contraste bajo sin bloquear el guardado", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    const primaryHex = screen.getByLabelText("Color de marca en hexadecimal");
    await user.clear(primaryHex);
    await user.type(primaryHex, "#eeeeee");

    expect(screen.getByText(/El texto de los botones sobre el color de marca/)).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: "Guardar cambios" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;
    expect(body.primaryColor).toBe("#eeeeee");
  });

  /**
   * T8 fase 7 — el interruptor global de "aceptando pedidos" sale de acá.
   *
   * Con locales cargados (siempre: la migración crea el primario) el que manda es el del
   * local, así que el de esta pantalla era un control que no hacía lo que decía. Los
   * valores guardados se siguen mandando al guardar, porque son el respaldo que usa el
   * servidor cuando el negocio no tiene ningún local.
   */
  it("ya no ofrece el interruptor global de pedidos y apunta a Locales (T8)", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    expect(screen.queryByLabelText("Aceptando pedidos")).toBeNull();
    expect(screen.queryByLabelText("Mensaje de cerrado")).toBeNull();

    // Dos punteros a Locales (aceptación de pedidos y horarios): los dos llevan al mismo lado.
    const pointers = screen.getAllByRole("link", { name: "Locales" });
    expect(pointers.length).toBeGreaterThanOrEqual(2);
    for (const pointer of pointers) {
      expect(pointer.getAttribute("href")).toBe("/admin/locations");
    }
    expect(screen.getByText(/se configuran por local/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;
    // El respaldo viaja igual: no se pierde lo que ya estaba guardado.
    const saved = initialSettings();
    expect(body.isAcceptingOrders).toBe(saved.isAcceptingOrders);
    expect(body.closedMessage).toBe(saved.closedMessage);
  });

  /**
   * Factura simple (2026-09-18) — los **datos fiscales del negocio**.
   *
   * Los campos existían en la base desde la migración de la factura, pero no estaban cableados al admin: la
   * factura salía siempre sin razón social ni RUC. La sección los edita, son **opcionales** (vacío = la
   * línea no se imprime) y viajan con el mismo «Guardar cambios» que el resto.
   */
  it("la sección de datos fiscales se precarga con lo que hay guardado", () => {
    const saved = { ...initialSettings(), legalName: "One Burger S.A.", taxId: "J0310000123456" };
    render(<AdminSettingsClientPage initialSettings={saved} />);

    expect(inputValue(screen.getByLabelText("Razón social"))).toBe("One Burger S.A.");
    expect(inputValue(screen.getByLabelText("RUC"))).toBe("J0310000123456");
    expect(inputValue(screen.getByLabelText("Dirección fiscal"))).toBe("");
    expect(inputValue(screen.getByLabelText("Teléfono fiscal"))).toBe("");
  });

  it("los datos fiscales viajan en el payload al guardar", async () => {
    const user = userEvent.setup();
    render(<AdminSettingsClientPage initialSettings={initialSettings()} />);

    await user.type(screen.getByLabelText("Razón social"), "One Burger S.A.");
    await user.type(screen.getByLabelText("RUC"), "J0310000123456");
    await user.type(screen.getByLabelText("Dirección fiscal"), "Camino de Oriente, Managua");
    await user.type(screen.getByLabelText("Teléfono fiscal"), "+50588887777");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as Record<string, unknown>;

    expect(body.legalName).toBe("One Burger S.A.");
    expect(body.taxId).toBe("J0310000123456");
    expect(body.taxAddress).toBe("Camino de Oriente, Managua");
    expect(body.taxPhone).toBe("+50588887777");
  });
});
