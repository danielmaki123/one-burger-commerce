// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessSettingsProvider } from "@/shared/lib/business-settings";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

import PosClient from "./pos-client";

/**
 * TASK-302 + TASK-303b — la pantalla del mostrador.
 *
 * Se prueba lo que el cajero hace: elegir el local, buscar, armar la venta y **cobrar de una vez**
 * (nombre y número obligatorios, correo opcional). El caso que puede salir caro es el del total: el
 * número que se muestra sale de la misma fórmula que el servidor y **el cobro manda el total que el
 * servidor calculó**, así que la pantalla tiene que mostrar el empaque.
 */

const productos = {
  data: {
    products: [
      {
        id: "prod_taco",
        name: "Taco de birria",
        price: 35,
        packagingFeeAmount: 5,
        categoryId: "cat_tacos",
        categoryName: "Tacos",
        requiresOptions: false,
      },
      {
        id: "prod_especial",
        name: "Taco especial",
        price: 55,
        packagingFeeAmount: 0,
        categoryId: "cat_tacos",
        categoryName: "Tacos",
        requiresOptions: true,
      },
      {
        id: "prod_cola",
        name: "Cola",
        price: 25,
        packagingFeeAmount: 0,
        categoryId: "cat_bebidas",
        categoryName: "Bebidas",
        requiresOptions: false,
      },
    ],
    total: 3,
    query: "",
  },
};

const ventaCobrada = {
  data: {
    orderId: "ord_01",
    orderNumber: "P-ABC123",
    total: 40,
    paid: 100,
    change: 60,
    payments: [{ id: "pay_01", method: "cash", amount: 100, currency: "NIO" }],
  },
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const locations = [
  { id: "loc_norte", name: "Local Norte" },
  { id: "loc_sur", name: "Local Sur" },
];

/** El total que se muestra en la venta (la fila "Total" del desglose). */
function totalDeLaVenta() {
  return screen.getByText("Total").nextElementSibling?.textContent;
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre del cliente"), "Cliente Mostrador");
  await user.type(screen.getByLabelText("Número del cliente"), "88887777");
}

describe("PosClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url === "/api/admin/pos/sale" && init?.method === "POST") return jsonResponse(ventaCobrada, true, 201);
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

  it("el total incluye el empaque del producto (TASK-303b)", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));

    const venta = screen.getByRole("region", { name: "Venta en curso" });
    expect(within(venta).getByText("Taco de birria")).toBeTruthy();
    expect(within(venta).getByText("Empaque")).toBeTruthy();
    expect(totalDeLaVenta()).toBe("C$40.00");
    expect(screen.getByRole("button", { name: "Cobrar C$40.00" })).toBeTruthy();
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

    await user.click(screen.getByRole("button", { name: "Agregar una unidad de Cola" }));
    expect(totalDeLaVenta()).toBe("C$50.00");

    await user.click(screen.getByRole("button", { name: "Quitar una unidad de Cola" }));
    expect(totalDeLaVenta()).toBe("C$25.00");

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

  it("cobra la venta de una vez y limpia el mostrador (TASK-303b)", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "100");
    await user.click(screen.getByRole("button", { name: /^Cobrar / }));

    const saleCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/admin/pos/sale");
    expect(saleCall).toBeTruthy();
    const body = JSON.parse(String((saleCall![1] as RequestInit).body));

    expect(body.locationId).toBe("loc_norte");
    expect(body.customer).toEqual({
      name: "Cliente Mostrador",
      whatsapp: "88887777",
      email: null,
    });
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      productId: "prod_taco",
      quantity: 1,
      packagingUnitAmount: 5,
    });
    expect(body.payments).toEqual([{ method: "cash", currency: "NIO", amount: 100 }]);
    expect(body.idempotencyKey).toBeTruthy();

    const confirmacion = await screen.findByRole("status");
    expect(confirmacion.textContent).toContain("P-ABC123");
    expect(confirmacion.textContent).toContain("Cambio C$60.00");
    // El mostrador queda listo para la venta siguiente.
    expect(screen.getByText("Agregá productos del catálogo para armar la venta.")).toBeTruthy();
  });

  it("no manda nada si falta el nombre o el monto: lo dice en el campo", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await user.click(screen.getByRole("button", { name: /^Cobrar / }));

    expect(screen.getByText("Escribí el nombre del cliente.")).toBeTruthy();
    expect(screen.getByText("Escribí con cuánto paga el cliente.")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/admin/pos/sale")).toBe(
      false,
    );
  });

  it("muestra el error por campo que devuelve el servidor", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url === "/api/admin/pos/sale" && init?.method === "POST") {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Revisá los datos de la venta.",
              fields: { "customer.email": "Revisá el correo" },
            },
          },
          false,
          422,
        );
      }
      return jsonResponse({ data: [] });
    });

    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "100");
    await user.click(screen.getByRole("button", { name: /^Cobrar / }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Revisá los datos de la venta.")).toBeTruthy();
  });

  it("ofrece cobrar en dólares solo si hay tipo de cambio cargado", async () => {
    // Sin proveedor de configuración se usan los defaults: no hay tasa, así que no se ofrece elegir
    // moneda (y por eso el caso de arriba cobra en córdobas).
    expect(screen.queryByLabelText("Moneda del cobro")).toBeNull();

    render(
      <BusinessSettingsProvider
        settings={{
          ...DEFAULT_BUSINESS_SETTINGS,
          usdExchangeRate: 36.5,
          updatedAt: "2026-09-14T00:00:00.000Z",
          updatedByUserId: null,
        }}
      >
        <PosClient locations={locations} />
      </BusinessSettingsProvider>,
    );

    expect(await screen.findByText("Taco de birria")).toBeTruthy();
    const moneda = screen.getByLabelText("Moneda del cobro");
    await userEvent.setup().selectOptions(moneda, "USD");

    expect(screen.getByRole("option", { name: "USD" })).toBeTruthy();
  });

  it("sin locales activos lo dice y no pide catálogo", () => {
    render(<PosClient locations={[]} />);

    expect(screen.getByText("Sin locales activos")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra el error del catálogo con reintento", async () => {
    fetchMock.mockImplementation(() => jsonResponse({}, false));
    render(<PosClient locations={locations} />);

    expect(await screen.findByText("No se pudo cargar el catálogo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
