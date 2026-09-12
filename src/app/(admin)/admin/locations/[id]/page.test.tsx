// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "loc_norte" }),
}));

import LocationCatalogPage from "./page";

/**
 * T8 fase 4b — el catálogo de un local.
 *
 * Cada producto muestra el precio que cobra **este** local (y el del negocio cuando tiene
 * precio propio) y su estado. El sheet deja poner precio propio, marcarlo agotado o sacarlo
 * del local; dejarlo "como el negocio" borra la excepción.
 */
const catalog = {
  data: [
    {
      productId: "seed-prod-01",
      name: "Taco de Birria",
      categoryId: "cat_tacos",
      basePrice: 35,
      price: 42,
      hasPriceOverride: true,
      isAvailable: false,
      isSold: true,
    },
    {
      productId: "seed-prod-02",
      name: "Agua de Jamaica",
      categoryId: "cat_bebidas",
      basePrice: 25,
      price: 25,
      hasPriceOverride: false,
      isAvailable: true,
      isSold: true,
    },
    {
      productId: "seed-prod-03",
      name: "Flan Napolitano",
      categoryId: "cat_postres",
      basePrice: 40,
      price: 40,
      hasPriceOverride: false,
      isAvailable: true,
      isSold: false,
    },
  ],
  meta: {
    location: { id: "loc_norte", name: "Norte" },
    total: 3,
    sold: 2,
    unavailable: 1,
    overridden: 1,
  },
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : String(input);
}

describe("LocationCatalogPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/locations/loc_norte/products" && method === "GET") {
        return jsonResponse(catalog);
      }

      return jsonResponse({
        data: { locationId: "loc_norte", productId: "seed-prod-01" },
        meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lista el catálogo del local con los dos precios y su estado", async () => {
    render(<LocationCatalogPage />);

    expect(await screen.findByRole("heading", { name: "Norte" })).toBeTruthy();
    expect(screen.getByText(/3 productos · 2 en este local/)).toBeTruthy();
    // El precio propio muestra también el del negocio.
    expect(screen.getByText("C$42.00 · base C$35.00")).toBeTruthy();
    expect(screen.getByText("C$25.00")).toBeTruthy();
    expect(screen.getByText("Agotado acá")).toBeTruthy();
    expect(screen.getByText("No se vende acá")).toBeTruthy();
  });

  it("guarda un precio propio y manda el estado completo", async () => {
    const user = userEvent.setup();
    render(<LocationCatalogPage />);

    await user.click(await screen.findByRole("button", { name: "Editar Taco de Birria" }));
    expect((screen.getByLabelText("Precio en este local") as HTMLInputElement).value).toBe("42");

    await user.clear(screen.getByLabelText("Precio en este local"));
    await user.type(screen.getByLabelText("Precio en este local"), "45");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Producto actualizado.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/locations/loc_norte/products/seed-prod-01",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ priceOverride: 45, isAvailable: false, isActive: true }),
      }),
    );
  });

  it("volver al precio base manda null y no el precio del negocio", async () => {
    const user = userEvent.setup();
    render(<LocationCatalogPage />);

    await user.click(await screen.findByRole("button", { name: "Editar Taco de Birria" }));
    await user.click(screen.getByRole("button", { name: "Volver al precio base" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/locations/loc_norte/products/seed-prod-01",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ priceOverride: null, isAvailable: false, isActive: true }),
        }),
      ),
    );
    expect(await screen.findByText("Producto actualizado.")).toBeTruthy();
  });

  it("saca un producto del local sin borrarlo del menú", async () => {
    const user = userEvent.setup();
    render(<LocationCatalogPage />);

    await user.click(await screen.findByRole("button", { name: "Editar Agua de Jamaica" }));
    await user.selectOptions(screen.getByLabelText("En este local"), "no");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/locations/loc_norte/products/seed-prod-02",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ priceOverride: null, isAvailable: true, isActive: false }),
        }),
      ),
    );
  });

  it("muestra el error del servidor en el campo que corresponde", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";

      if (url === "/api/admin/locations/loc_norte/products" && method === "GET") {
        return jsonResponse(catalog);
      }

      return jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            fields: { priceOverride: "El precio no puede ser negativo" },
          },
        },
        false,
      );
    });

    render(<LocationCatalogPage />);

    await user.click(await screen.findByRole("button", { name: "Editar Agua de Jamaica" }));
    await user.type(screen.getByLabelText("Precio en este local"), "-5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Revisá los campos marcados.")).toBeTruthy();
    expect(screen.getByText("El precio no puede ser negativo")).toBeTruthy();
  });

  it("si el catálogo no carga, se puede reintentar", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ error: {} }, false));

    render(<LocationCatalogPage />);

    expect(await screen.findByText("No se pudo cargar el catálogo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
