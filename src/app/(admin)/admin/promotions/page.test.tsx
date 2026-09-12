// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminPromotionsPage from "./page";

/**
 * T9c — la pantalla del admin.
 *
 * Lo que se prueba acá es lo que el owner hace: ver las promos, crear una, editarla y
 * borrarla. Los textos de la ficha salen de los datos guardados (T9 "llevá 3 y pagá 2").
 */
const bogo = {
  id: "coupon_1",
  code: "B2G1",
  type: "bogo",
  value: 0,
  isActive: true,
  usageLimit: 0,
  usedCount: 0,
  expiresAt: null,
  buyQuantity: 2,
  freeQuantity: 1,
  scopeType: "all",
  scopeId: null,
  status: "active",
};

const porcentaje = {
  id: "coupon_2",
  code: "VERANO",
  type: "percentage",
  value: 10,
  isActive: true,
  usageLimit: 10,
  usedCount: 3,
  expiresAt: null,
  buyQuantity: null,
  freeQuantity: null,
  scopeType: "all",
  scopeId: null,
  status: "active",
};

const categorias = {
  data: [
    { id: "cat_tacos", name: "Tacos", slug: "tacos", isActive: true },
  ],
};

const productos = {
  data: [{ id: "prod_taco", name: "Taco de birria", availability: { isActive: true } }],
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : String(input);
}

describe("AdminPromotionsPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/promotions" && method === "GET") {
        return jsonResponse({ data: [bogo, porcentaje] });
      }
      if (url.startsWith("/api/admin/menu/categories")) return jsonResponse(categorias);
      if (url.startsWith("/api/admin/menu/subcategories")) return jsonResponse({ data: [] });
      if (url.startsWith("/api/admin/menu/products")) return jsonResponse(productos);

      return jsonResponse({ data: { id: "coupon_3" } });
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lista las promos con su regla, su uso y su estado", async () => {
    render(<AdminPromotionsPage />);

    expect(await screen.findByText("B2G1")).toBeTruthy();
    expect(screen.getByText(/Llevá 3 y pagá 2/)).toBeTruthy();
    expect(screen.getByText(/Sin usos todavía · sin límite/)).toBeTruthy();
    expect(screen.getByText(/3 de 10 usos/)).toBeTruthy();
    expect(screen.getAllByText("Activa").length).toBeGreaterThan(0);
  });

  it("solo la promo por cantidad pide alcance", async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);

    await user.click(screen.getByRole("button", { name: "Nueva promo" }));
    expect(screen.queryByLabelText("Alcance")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Tipo"), "bogo");
    expect(screen.getByLabelText("Alcance")).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Alcance"), "category");
    expect(screen.getByLabelText("¿A qué alcanza?")).toBeTruthy();
  });

  it("no manda nada si el código está vacío y lo dice en el campo", async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);

    await user.click(screen.getByRole("button", { name: "Nueva promo" }));
    await user.click(screen.getByRole("button", { name: "Crear promo" }));

    expect(await screen.findByText("Escribí el código que va a usar el cliente")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/promotions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("crea una promo por cantidad con sus unidades y su alcance", async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);

    await user.click(screen.getByRole("button", { name: "Nueva promo" }));
    await user.type(screen.getByLabelText("Código"), "tacos2x1");
    await user.selectOptions(screen.getByLabelText("Tipo"), "bogo");
    await user.type(screen.getByLabelText("Unidades que se llevan"), "1");
    await user.type(screen.getByLabelText("Unidades gratis"), "1");
    await user.selectOptions(screen.getByLabelText("Alcance"), "category");
    await user.selectOptions(screen.getByLabelText("¿A qué alcanza?"), "cat_tacos");
    await user.click(screen.getByRole("button", { name: "Crear promo" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/promotions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            code: "TACOS2X1",
            type: "bogo",
            value: 0,
            isActive: true,
            usageLimit: 0,
            expiresAt: null,
            buyQuantity: 1,
            freeQuantity: 1,
            scopeType: "category",
            scopeId: "cat_tacos",
          }),
        }),
      );
    });
  });

  it("abre una promo guardada con sus valores y guarda el cambio", async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);

    await user.click(await screen.findByRole("button", { name: "Editar promo B2G1" }));
    expect((screen.getByLabelText("Unidades que se llevan") as HTMLInputElement).value).toBe("2");

    await user.clear(screen.getByLabelText("Unidades que se llevan"));
    await user.type(screen.getByLabelText("Unidades que se llevan"), "3");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/promotions/coupon_1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"buyQuantity":3'),
        }),
      );
    });
  });

  it("muestra el error del servidor en el campo que corresponde", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/promotions" && method === "GET") {
        return jsonResponse({ data: [bogo, porcentaje] });
      }
      if (url.startsWith("/api/admin/menu/categories")) return jsonResponse(categorias);
      if (url.startsWith("/api/admin/menu/subcategories")) return jsonResponse({ data: [] });
      if (url.startsWith("/api/admin/menu/products")) return jsonResponse(productos);

      return jsonResponse(
        {
          error: {
            code: "CONFLICT",
            message: "Coupon code already exists",
            fields: { code: "Ya hay una promo con el código B2G1" },
          },
        },
        false,
      );
    });

    render(<AdminPromotionsPage />);

    await user.click(screen.getByRole("button", { name: "Nueva promo" }));
    await user.type(screen.getByLabelText("Código"), "B2G1");
    await user.click(screen.getByRole("button", { name: "Crear promo" }));

    expect(await screen.findByText("Ya hay una promo con el código B2G1")).toBeTruthy();
  });

  it("borra una promo después de confirmar", async () => {
    const user = userEvent.setup();
    render(<AdminPromotionsPage />);

    await user.click(await screen.findByRole("button", { name: "Editar promo VERANO" }));
    await user.click(screen.getByRole("button", { name: "Eliminar promo VERANO" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/promotions/coupon_2",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Editar promo VERANO" })).toBeNull();
    });
  });
});
