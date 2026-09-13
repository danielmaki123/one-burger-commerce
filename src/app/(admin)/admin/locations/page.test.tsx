// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";

import AdminLocationsPage from "./page";

/**
 * T8 fase 3 — la pantalla de locales.
 *
 * Lo que se prueba es lo que el owner hace: ver los locales, crear uno, editarlo y
 * borrarlo. El horario se edita día por día y viaja completo en el payload.
 */
const principal = {
  id: "loc_principal",
  name: "Principal",
  slug: "principal",
  isActive: true,
  sortOrder: 0,
  addressLine: "Frente al parque",
  city: "Jinotepe",
  addressReference: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  phone: null,
  whatsapp: "50588770888",
  businessHours: DEFAULT_BUSINESS_HOURS,
  pickupLeadMinutes: 25,
  pickupMaxMinutes: 40,
  isAcceptingOrders: true,
  closedMessage: null,
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

const norte = {
  ...principal,
  id: "loc_norte",
  name: "Norte",
  slug: "norte",
  sortOrder: 1,
  isActive: false,
  addressLine: "Carretera sur",
  city: "Diriamba",
  pickupMaxMinutes: null,
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : String(input);
}

describe("AdminLocationsPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/locations" && method === "GET") {
        return jsonResponse({ data: [principal, norte] });
      }
      if (url === "/api/admin/business-settings") {
        return jsonResponse({ data: { timezone: "America/Managua" } });
      }

      return jsonResponse({ data: { id: "loc_nueva" } });
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lista los locales con su estado, su dirección y el horario de hoy", async () => {
    render(<AdminLocationsPage />);

    expect(await screen.findByText("Principal")).toBeTruthy();
    expect(screen.getByText("Frente al parque, Jinotepe")).toBeTruthy();
    expect(screen.getAllByText("Carretera sur, Diriamba").length).toBe(1);
    // El horario de hoy va en la misma línea que la preparación: se busca por patrón.
    expect((await screen.findAllByText(/Hoy 12:00 a 22:00/)).length).toBe(2);
    expect(screen.getByText("Activo")).toBeTruthy();
    expect(screen.getByText("Apagado")).toBeTruthy();
  });

  it("abre el formulario con el horario del negocio ya cargado", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(screen.getByRole("button", { name: "Nuevo local" }));

    expect(screen.getByLabelText("Nombre")).toBeTruthy();
    expect(screen.getByLabelText("Identificador para la URL")).toBeTruthy();
    expect(screen.getByLabelText("Lunes abre")).toBeTruthy();
    expect(screen.getByLabelText("Minutos de preparación")).toBeTruthy();
  });

  it("no manda nada si falta el nombre y lo dice en el campo", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(screen.getByRole("button", { name: "Nuevo local" }));
    await user.click(screen.getByRole("button", { name: "Crear local" }));

    expect(await screen.findByText("Escribí el nombre del local")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/locations",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("crea un local con su horario completo y sin rango de preparación", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(screen.getByRole("button", { name: "Nuevo local" }));
    await user.type(screen.getByLabelText("Nombre"), "Sucursal Norte");
    await user.type(screen.getByLabelText("Identificador para la URL"), "sucursal-norte");
    await user.type(screen.getByLabelText("Ciudad"), "Diriamba");
    await user.click(screen.getByRole("button", { name: "Crear local" }));

    expect(await screen.findByText("Local creado.")).toBeTruthy();

    const [, init] = fetchMock.mock.calls.find(
      ([url, options]) =>
        requestUrl(url as RequestInfo) === "/api/admin/locations" &&
        (options as RequestInit | undefined)?.method === "POST",
    ) as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body).toMatchObject({
      name: "Sucursal Norte",
      slug: "sucursal-norte",
      city: "Diriamba",
      isActive: true,
      pickupLeadMinutes: 25,
      pickupMaxMinutes: null,
      isAcceptingOrders: true,
    });
    expect(Object.keys(body.businessHours as object)).toHaveLength(7);
  });

  it("abre un local guardado con sus valores y guarda el cambio", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Editar local Norte" }));
    expect((screen.getByLabelText("Minutos de preparación") as HTMLInputElement).value).toBe("25");

    await user.clear(screen.getByLabelText("Minutos de preparación"));
    await user.type(screen.getByLabelText("Minutos de preparación"), "40");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Local actualizado.")).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/locations/loc_norte",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"pickupLeadMinutes":40'),
      }),
    );
  });

  it("muestra el error del servidor en el campo que corresponde", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/locations" && method === "GET") {
        return jsonResponse({ data: [principal, norte] });
      }
      if (url === "/api/admin/business-settings") {
        return jsonResponse({ data: { timezone: "America/Managua" } });
      }

      return jsonResponse(
        {
          error: {
            code: "CONFLICT",
            message: "Location slug already exists",
            fields: { slug: "Ya hay un local con el identificador norte" },
          },
        },
        false,
      );
    });

    render(<AdminLocationsPage />);

    await user.click(screen.getByRole("button", { name: "Nuevo local" }));
    await user.type(screen.getByLabelText("Nombre"), "Otro local");
    await user.type(screen.getByLabelText("Identificador para la URL"), "norte");
    await user.click(screen.getByRole("button", { name: "Crear local" }));

    expect(await screen.findByText("Revisá los campos marcados.")).toBeTruthy();
    expect(screen.getByText("Ya hay un local con el identificador norte")).toBeTruthy();
  });

  it("borra un local después de confirmar", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Editar local Norte" }));
    await user.click(screen.getByRole("button", { name: "Eliminar local Norte" }));

    expect(await screen.findByText("Local borrado.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/locations/loc_norte",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(screen.queryByRole("button", { name: "Editar local Norte" })).toBeNull();
  });

  /**
   * A — activar y apagar una sucursal de un toque, sin abrir el formulario completo.
   *
   * El guardado viaja **completo** (es el contrato del PATCH), así que el toque manda el local tal
   * como está con `isActive` invertido: no se pierde nada de lo demás.
   */
  it("apaga un local activo de un toque", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Apagar Principal" }));

    expect(await screen.findByText("Local apagado.")).toBeTruthy();

    const [, init] = fetchMock.mock.calls.find(
      ([url, options]) =>
        requestUrl(url as RequestInfo) === "/api/admin/locations/loc_principal" &&
        (options as RequestInit | undefined)?.method === "PATCH",
    ) as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body.isActive).toBe(false);
    // El resto de la configuración viaja igual: el toque no borra datos.
    expect(body).toMatchObject({
      name: "Principal",
      slug: "principal",
      isAcceptingOrders: true,
      pickupLeadMinutes: 25,
    });
  });

  it("activa un local apagado de un toque", async () => {
    const user = userEvent.setup();
    render(<AdminLocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Activar Norte" }));

    expect(await screen.findByText("Local activado.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/locations/loc_norte",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"isActive":true'),
      }),
    );
  });

  it("muestra el motivo cuando la API rechaza apagar el único local activo", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/locations" && method === "GET") {
        return jsonResponse({ data: [principal, norte] });
      }
      if (url === "/api/admin/business-settings") {
        return jsonResponse({ data: { timezone: "America/Managua" } });
      }

      return jsonResponse(
        {
          error: {
            code: "CONFLICT",
            message: "Cannot disable the last active location",
            fields: {
              isActive:
                "Este es el único local activo: activá otro antes de apagar este, o dejalo encendido",
            },
          },
        },
        false,
      );
    });

    render(<AdminLocationsPage />);

    await user.click(await screen.findByRole("button", { name: "Apagar Principal" }));

    expect(
      await screen.findByText(
        "Este es el único local activo: activá otro antes de apagar este, o dejalo encendido",
      ),
    ).toBeTruthy();
  });
});
