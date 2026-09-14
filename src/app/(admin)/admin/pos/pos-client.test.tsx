// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PosClient from "./pos-client";

/**
 * TASK-302 — la pantalla del mostrador.
 *
 * Se prueba lo que el cajero hace: elegir el local, buscar, agregar al borrador y ajustar cantidades.
 * Y una cosa que **no** puede pasar todavía: que exista un botón de cobrar. El cobro con `Payment` es
 * TASK-303; un botón que no cobra es un control que miente.
 */

const productos = {
  data: {
    products: [
      {
        id: "prod_taco",
        name: "Taco de birria",
        price: 35,
        categoryId: "cat_tacos",
        categoryName: "Tacos",
        requiresOptions: false,
      },
      {
        id: "prod_especial",
        name: "Taco especial",
        price: 55,
        categoryId: "cat_tacos",
        categoryName: "Tacos",
        requiresOptions: true,
      },
      {
        id: "prod_cola",
        name: "Cola",
        price: 25,
        categoryId: "cat_bebidas",
        categoryName: "Bebidas",
        requiresOptions: false,
      },
    ],
    total: 3,
    query: "",
  },
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

const locations = [
  { id: "loc_norte", name: "Local Norte" },
  { id: "loc_sur", name: "Local Sur" },
];

describe("PosClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("carga el catálogo del primer local y lo muestra con su precio", async () => {
    render(<PosClient locations={locations} />);

    expect(await screen.findByText("Taco de birria")).toBeTruthy();
    expect(screen.getByText("C$35.00")).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain("locationId=loc_norte");
  });

  it("busca en memoria: escribir no dispara otra consulta y filtra por nombre", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    const callsAfterLoad = fetchMock.mock.calls.length;

    await user.type(screen.getByLabelText("Buscar en el catálogo"), "cola");

    expect(screen.getByText("Cola")).toBeTruthy();
    expect(screen.queryByText("Taco de birria")).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
  });

  it("agrega al borrador con el botón y actualiza el subtotal", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));

    const venta = screen.getByRole("region", { name: "Venta en curso" });
    expect(within(venta).getByText("Taco de birria")).toBeTruthy();
    expect(within(venta).getByText("C$35.00")).toBeTruthy();
  });

  it("no ofrece agregar un producto que obliga a elegir opciones", async () => {
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco especial");

    expect(screen.queryByRole("button", { name: "Agregar Taco especial a la venta" })).toBeNull();
    expect(screen.getByText("Se elige en la carta")).toBeTruthy();
  });

  it("suma y resta unidades, y sacar deja la venta vacía", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Cola");
    await user.click(screen.getByRole("button", { name: "Agregar Cola a la venta" }));

    // Se mira la venta y no la pantalla entera: el precio del producto también aparece en la
    // tarjeta del catálogo, así que una búsqueda global es ambigua por diseño.
    const venta = () => within(screen.getByRole("region", { name: "Venta en curso" }));

    await user.click(screen.getByRole("button", { name: "Agregar una unidad de Cola" }));
    expect(venta().getByText("C$50.00")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Cola" }));
    expect(venta().getByText("C$25.00")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Sacar Cola de la venta" }));
    expect(await screen.findByText("Agregá productos del catálogo para armar la venta.")).toBeTruthy();
  });

  it("cambiar de local vuelve a pedir el catálogo y arranca una venta nueva", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await user.selectOptions(screen.getByLabelText("Local"), "loc_sur");

    await waitFor(() =>
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("locationId=loc_sur"),
    );
    expect(await screen.findByText("Agregá productos del catálogo para armar la venta.")).toBeTruthy();
  });

  it("todavía no tiene cobro: el botón de cobrar llega en TASK-303", async () => {
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");

    expect(screen.queryByRole("button", { name: /cobrar/i })).toBeNull();
  });

  it("sin locales activos lo dice y no pide catálogo", () => {
    render(<PosClient locations={[]} />);

    expect(screen.getByText("Sin locales activos")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor con reintento", async () => {
    fetchMock.mockImplementation(() => jsonResponse({}, false));
    render(<PosClient locations={locations} />);

    expect(await screen.findByText("No se pudo cargar el catálogo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
