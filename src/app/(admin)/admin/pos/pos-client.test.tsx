// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessSettingsProvider } from "@/shared/lib/business-settings";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

// `vi.hoisted`: las fábricas de `vi.mock` se elevan al tope del archivo, así que las referencias
// tienen que existir antes de que el módulo se importe.
const { renderReceiptJpegMock, shareOrDownloadReceiptMock } = vi.hoisted(() => ({
  renderReceiptJpegMock: vi.fn(async (_data: unknown) => new Blob(["jpg"], { type: "image/jpeg" })),
  shareOrDownloadReceiptMock: vi.fn(async (_blob: Blob, _fileName: string) => "downloaded" as const),
}));

vi.mock("@/shared/lib/receipt-image", () => ({
  renderReceiptJpeg: renderReceiptJpegMock,
  shareOrDownloadReceipt: shareOrDownloadReceiptMock,
}));

import PosClient, { POS_REFRESH_MS } from "./pos-client";

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

/**
 * Tarea 1 del brief (2026-09-17) — el POS **ya no administra la caja**: abrir y cerrar se hace en «Caja
 * del día». Acá el mock responde un turno **abierto** (el estado en el que el cajero cobra) y el caso de
 * «sin caja abierta» lo dobla a `null` para comprobar el aviso y el enlace.
 */
async function esperarCajaAbierta() {
  await screen.findByText(/Caja abierta · fondo/);
}

describe("PosClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const turnoAbierto = {
    id: "shift_1",
    openedAt: "2026-09-15T14:00:00.000Z",
    openingAmount: 1000,
  };

  beforeEach(() => {
    // Bloque 12.3: el POS ahora **guarda la venta en curso** en el dispositivo y la recupera al montar.
    // Sin limpiar acá, el borrador de un caso se restaura en el siguiente (líneas duplicadas y totales
    // que no son los del caso): cada test arranca con el mostrador vacío, como una terminal nueva.
    localStorage.clear();
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url === "/api/admin/pos/sale" && init?.method === "POST") return jsonResponse(ventaCobrada, true, 201);
      if (url.startsWith("/api/admin/pos/shift?")) return jsonResponse({ data: turnoAbierto });
      if (url === "/api/admin/pos/shift/open" && init?.method === "POST") {
        return jsonResponse(
          { data: { id: "shift_1", openedAt: "2026-09-15T14:00:00.000Z", openingAmount: 1000 } },
          true,
          201,
        );
      }
      if (url === "/api/admin/pos/shift/close" && init?.method === "POST") {
        return jsonResponse({
          data: {
            closingAmount: 900,
            expectedAmount: 1000,
            difference: -100,
            expectedByCurrency: { NIO: 1000 },
          },
          meta: { expectedByCurrency: { NIO: 1000 } },
        });
      }
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

    // Bloque 9.2: sin caja abierta el cobro está bloqueado (el servidor lo rechaza con 409), así que
    // la venta arranca abriendo la caja, que es lo que hace el cajero en el local.
    await esperarCajaAbierta();

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

  /**
   * Bloque 4 del roadmap del POS (Fase 2) — partir el cobro entre medios.
   *
   * El contrato aceptaba N cobros desde TASK-303b, pero la pantalla mandaba uno. Lo que se fija acá es
   * la **mecánica de la pantalla**: la fila extra existe, ofrece transferencia con su referencia y se
   * puede quitar. El **payload** que sale del POS se prueba en el test de la ruta (`sale-payload`), que
   * es donde vive el contrato del cobro y no depende del tipeo del navegador.
   */
  it("parte el cobro: agrega una fila con transferencia y su referencia (Bloque 4)", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await esperarCajaAbierta();
    await screen.findByText("Taco de birria");

    await user.click(screen.getByRole("button", { name: "Partir el cobro" }));

    // La fila nueva arranca en transferencia y pide la referencia del voucher.
    expect(screen.getByLabelText("Referencia de la transferencia (opcional)")).toBeTruthy();
    expect(screen.getAllByLabelText("Con cuánto paga")).toHaveLength(2);
    expect(screen.getByText("Cobro 2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Quitar este cobro" }));

    expect(screen.queryByLabelText("Referencia de la transferencia (opcional)")).toBeNull();
    expect(screen.getAllByLabelText("Con cuánto paga")).toHaveLength(1);
  });

  it("un cobro partido incompleto no se manda", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await esperarCajaAbierta();
    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "40");
    await user.click(screen.getByRole("button", { name: "Partir el cobro" }));

    // La segunda fila quedó sin monto: el cobro no sale. El mensaje aparece en el campo y en el
    // resumen del error, por eso se cuenta en vez de buscarlo una vez.
    await user.click(screen.getByRole("button", { name: /^Cobrar / }));

    expect(screen.getAllByText("Completá el monto de todos los cobros.").length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/admin/pos/sale")).toBe(
      false,
    );
  });

  it("no manda nada si falta el nombre o el monto: lo dice en el campo", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await esperarCajaAbierta();
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

  /**
   * Tarea 1 del brief (2026-09-17) — el POS no administra la caja: la abre y la cierra «Caja del día».
   *
   * Lo que el POS sí hace es **decir el estado** (es lo que habilita cobrar) y llevar al lugar donde se
   * arregla, con un enlace, en vez de esconder un arqueo plegado en la cabecera del mostrador.
   */
  it("sin caja abierta avisa y manda a Caja del día", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url.startsWith("/api/admin/pos/shift?")) return jsonResponse({ data: null });
      return jsonResponse({ data: [] });
    });

    render(<PosClient locations={locations} />);

    expect(await screen.findByText("Sin caja abierta en este local.")).toBeTruthy();

    const abrir = screen.getByRole("link", { name: "Abrir la caja" });
    expect(abrir.getAttribute("href")).toBe("/admin/cash");
    // El conteo de billetes y el arqueo ya no viven acá.
    expect(screen.queryByLabelText("Cantidad de billetes de NIO 100")).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir caja" })).toBeNull();
  });

  it("con la caja abierta muestra el fondo y el enlace a la caja", async () => {
    render(<PosClient locations={locations} />);

    await esperarCajaAbierta();
    expect(screen.getByRole("link", { name: "Ver la caja" }).getAttribute("href")).toBe(
      "/admin/cash",
    );
  });

  /**
   * Tarea 3 del brief (2026-09-17) — **cierre obligatorio por sucursal** (1.7).
   *
   * Si la sucursal lo exige y la caja quedó abierta de otro día, el POS no deja cobrar y dice por qué y
   * dónde se arregla. La regla pura (`shift-close-policy.ts`) tiene sus propios casos; acá se comprueba
   * que la pantalla la use: el mismo turno, sin el interruptor, cobra normal.
   */
  it("con cierre obligatorio y caja de otro día el cobro queda bloqueado y lo explica", async () => {
    const user = userEvent.setup();
    const ayer = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url.startsWith("/api/admin/pos/shift?")) {
        return jsonResponse({ data: { id: "shift_1", openedAt: ayer, openingAmount: 1000 } });
      }
      return jsonResponse({ data: [] });
    });

    render(
      <PosClient locations={[{ id: "loc_norte", name: "Norte", requireShiftClose: true }]} />,
    );

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "100");

    expect(screen.getByText(/exige cerrar la caja todos los días/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Cobrar / }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("sin cierre obligatorio la caja vieja no bloquea el cobro", async () => {
    const user = userEvent.setup();
    const ayer = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url.startsWith("/api/admin/pos/shift?")) {
        return jsonResponse({ data: { id: "shift_1", openedAt: ayer, openingAmount: 1000 } });
      }
      return jsonResponse({ data: [] });
    });

    render(
      <PosClient locations={[{ id: "loc_norte", name: "Norte", requireShiftClose: false }]} />,
    );

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "100");

    expect(screen.queryByText(/exige cerrar la caja todos los días/)).toBeNull();
    expect((screen.getByRole("button", { name: /^Cobrar / }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  /**
   * Bloque 9.2 del roadmap del POS (Fase 2) — sin caja abierta el cobro está bloqueado **en pantalla**.
   *
   * El servidor lo rechaza con 409 (`registerPosSale`), pero un botón habilitado que va a fallar es un
   * control que miente: por eso el botón queda deshabilitado y el motivo se dice una sola vez, junto al
   * formulario de cobro.
   */
  it("con la caja cerrada el cobro está bloqueado y lo explica", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/pos/catalog")) return jsonResponse(productos);
      if (url.startsWith("/api/admin/pos/shift?")) return jsonResponse({ data: null });
      return jsonResponse({ data: [] });
    });

    render(<PosClient locations={locations} />);

    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "100");

    const cobrar = screen.getByRole("button", { name: /^Cobrar / });
    expect((cobrar as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/Abrí la caja para poder cobrar: un cobro con la caja cerrada/),
    ).toBeTruthy();

    // Y no se manda nada al servidor si igual se intenta.
    await user.click(cobrar);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/admin/pos/sale")).toBe(
      false,
    );
  });

  it("se refresca solo cada 3 s sin pisar lo que el cajero está armando (TASK-306)", async () => {
    // Se falsean **solo** los intervalos: `waitFor` y `userEvent` siguen con el reloj real.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const user = userEvent.setup();

    try {
      render(<PosClient locations={locations} />);

      await screen.findByText("Taco de birria");
      await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
      await user.type(screen.getByLabelText("Buscar en el catálogo"), "cola");

      const callsBefore = fetchMock.mock.calls.length;
      await act(async () => {
        vi.advanceTimersByTime(POS_REFRESH_MS);
      });

      const refreshed = fetchMock.mock.calls.slice(callsBefore).map(([input]) => String(input));
      expect(refreshed.some((url) => url.startsWith("/api/admin/pos/catalog"))).toBe(true);
      expect(refreshed.some((url) => url.startsWith("/api/admin/pos/shift?"))).toBe(true);

      // Lo que el cajero estaba escribiendo sigue donde estaba: el refresco no toca su estado.
      expect((screen.getByLabelText("Buscar en el catálogo") as HTMLInputElement).value).toBe("cola");
      expect(
        within(screen.getByRole("region", { name: "Venta en curso" })).getByText("Taco de birria"),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("genera el recibo del último cobro y lo ofrece para enviar (TASK-307)", async () => {
    const user = userEvent.setup();
    render(<PosClient locations={locations} />);

    await esperarCajaAbierta();
    await screen.findByText("Taco de birria");
    await user.click(screen.getByRole("button", { name: "Agregar Taco de birria a la venta" }));
    await fillCustomer(user);
    await user.type(screen.getByLabelText("Con cuánto paga"), "100");
    await user.click(screen.getByRole("button", { name: /^Cobrar / }));

    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Enviar recibo" }));

    expect(renderReceiptJpegMock).toHaveBeenCalledTimes(1);
    const receipt = renderReceiptJpegMock.mock.calls[0][0] as {
      orderNumber: string;
      businessCurrencyCode: string;
      lines: { name: string }[];
      payments: { methodLabel: string; amount: number }[];
    };
    expect(receipt.orderNumber).toBe("P-ABC123");
    expect(receipt.businessCurrencyCode).toBe("NIO");
    expect(receipt.lines[0].name).toBe("Taco de birria");
    expect(receipt.payments[0]).toMatchObject({ methodLabel: "Efectivo", amount: 100 });

    expect(shareOrDownloadReceiptMock).toHaveBeenCalledWith(expect.anything(), "recibo-P-ABC123.jpg");
    expect(await screen.findByText("Recibo listo para enviar o imprimir.")).toBeTruthy();
    // El recibo dibuja un canvas real y la suite completa corre en paralelo: con el default de 5 s
    // este caso se cayó una vez por carga de la máquina y pasó en aislamiento. Un timeout explícito
    // deja de medir la máquina y vuelve a medir el producto.
  }, 20_000);

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
