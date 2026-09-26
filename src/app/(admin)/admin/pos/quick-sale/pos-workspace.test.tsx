// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import { PosWorkspace, type PosWorkspaceCash, type PosWorkspaceSale } from "./pos-workspace";
import { POS_TWO_PANE_QUERY } from "./use-media-query";

/**
 * El **workspace** de la venta rápida: barra operativa, `CATALOGO | VENTA`, barra del celular y sheet.
 *
 * `SCREEN-POS-QUICK-SALE-001.1` §5–§8 es el contrato de esta pieza:
 *
 * 1. **Barra de una linea**: titulo, local, terminal y `● Caja abierta` como **estado** (sin enlaces ni
 *    acciones permanentes de caja).
 * 2. **Alto util**: en `lg` el workspace se acota al viewport, el catalogo scrollea dentro de su panel y el
 *    ticket usa todo su alto —las lineas se llevan el espacio libre, el CTA esta anclado al pie—.
 * 3. **El sheet no es una trampa**: cerrado no hay formulario en el DOM; abierto es un `<dialog open>` con
 *    nombre accesible, recibe el foco y Escape lo cierra devolviendolo al disparador.
 *
 * El corte de dos paneles es `lg` (1024 px): a 768 la barra lateral del panel todavia ocupa 264 px y dos
 * columnas dejarian las tarjetas de producto ilegibles. La spec lo permite («usar patron mobile si dos
 * columnas comprometen legibilidad»), y se prueba con `matchMedia` simulado, que es lo que el componente lee.
 */

type Listener = (event: { matches: boolean }) => void;

function stubViewport(twoPane: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === POS_TWO_PANE_QUERY ? twoPane : false,
      media: query,
      addEventListener: (_type: string, _listener: Listener) => {},
      removeEventListener: (_type: string, _listener: Listener) => {},
    }),
  });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "matchMedia");
});

const currency = DEFAULT_CURRENCY_FORMAT;

function emptySale(overrides: Partial<PosWorkspaceSale> = {}): PosWorkspaceSale {
  return {
    lines: [],
    changeQuantity: () => {},
    removeLine: () => {},
    totals: { subtotal: 0, packagingAmount: 0, total: 0 },
    appliedCoupon: null,
    manualDiscountAmount: 0,
    currency,
    customer: {
      name: "",
      whatsapp: "",
      email: "",
      fiscal: { wantsInvoice: false, taxId: "", legalName: "" },
    },
    setCustomer: () => {},
    payments: [],
    setPayments: () => {},
    addPaymentRow: () => {},
    removePaymentRow: () => {},
    fieldErrors: {},
    currencyCode: "NIO",
    usdExchangeRate: null,
    canCharge: true,
    blockedReason: null,
    total: 0,
    charging: false,
    saleError: null,
    restoredSale: false,
    onCharge: () => {},
    options: null,
    confirmation: null,
    ...overrides,
  };
}

function openCash(overrides: Partial<PosWorkspaceCash> = {}): PosWorkspaceCash {
  return {
    state: "open",
    loading: false,
    busy: false,
    error: null,
    onOpen: () => {},
    closeHref: "/admin/cash",
    ...overrides,
  };
}

function renderWorkspace({
  sale,
  cash,
  catalog,
}: {
  sale?: Partial<PosWorkspaceSale>;
  cash?: Partial<PosWorkspaceCash>;
  catalog?: Partial<Parameters<typeof PosWorkspace>[0]["catalog"]>;
} = {}) {
  const props: Parameters<typeof PosWorkspace>[0] = {
    catalog: {
      locationId: "loc_centro",
      locations: [{ id: "loc_centro", name: "Camino de Oriente" }],
      onLocationChange: () => {},
      terminals: [],
      terminalId: null,
      onTerminalChange: () => {},
      products: [],
      categories: [],
      query: "",
      onQueryChange: () => {},
      activeCategoryId: null,
      onCategorySelect: () => {},
      loading: false,
      loadError: null,
      onRetry: () => {},
      currency,
      onAdd: () => {},
      ...catalog,
    },
    sale: emptySale(sale),
    cash: openCash(cash),
  };

  return render(<PosWorkspace {...props} />);
}

describe("PosWorkspace", () => {
  it("la barra operativa es una sola linea: POS, local, terminal y estado de caja", () => {
    stubViewport(true);
    renderWorkspace({
      catalog: {
        terminals: [
          { id: "term_1", label: "Caja 1" },
          { id: "term_2", label: "Barra" },
        ],
        terminalId: "term_1",
      },
    });

    expect(screen.getByRole("heading", { level: 1, name: "POS" })).toBeTruthy();
    expect(screen.getByLabelText("Local")).toBeTruthy();
    expect(screen.getByLabelText("Terminal")).toBeTruthy();
    // El estado de caja de la barra (el otro `status` de la pantalla es el bloque de la caja en el
    // checkout, que con la caja abierta no se dibuja).
    expect(screen.getByRole("status").textContent).toContain("Caja abierta");

    // Sin hero y sin acciones permanentes de caja: el estado se muestra; la accion vive en el checkout.
    expect(screen.queryByRole("heading", { name: "Punto de venta" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ver la caja|Abrir la caja/ })).toBeNull();
  });

  it("con la caja cerrada, el estado esta en la barra y la accion en el checkout", () => {
    stubViewport(true);
    renderWorkspace({ cash: { state: "no-shift" } });

    const barra = screen.getByLabelText("Barra del mostrador");
    expect(within(barra).getByRole("status").textContent).toContain("Sin caja abierta");
    expect(screen.getByText("Caja cerrada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir caja" })).toBeTruthy();
  });

  it("con un turno de otro dia pide cerrarlo y no ofrece abrir otra", () => {
    stubViewport(true);
    renderWorkspace({ cash: { state: "pending-close" } });

    const barra = screen.getByLabelText("Barra del mostrador");
    expect(within(barra).getByRole("status").textContent).toContain("Cierre pendiente");
    expect(screen.getByText("La caja pertenece al turno anterior.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cerrar caja" }).getAttribute("href")).toBe(
      "/admin/cash",
    );
    expect(screen.queryByRole("button", { name: "Abrir caja" })).toBeNull();
  });

  it("la accion de abrir la caja la ejecuta la pantalla", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    const onOpen = vi.fn();

    renderWorkspace({ cash: { state: "no-shift", onOpen } });

    await user.click(screen.getByRole("button", { name: "Abrir caja" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("el catalogo y la venta conviven como dos paneles y el ticket usa el alto util", () => {
    stubViewport(true);
    renderWorkspace();

    expect(screen.getByRole("region", { name: "Catálogo" })).toBeTruthy();

    const venta = screen.getByTestId("pos-sale-pane");
    expect(venta.className).toContain("lg:max-h-[calc(100vh-1.5rem)]");
    expect(venta.className).toContain("lg:fixed");
    expect(screen.getByTestId("pos-sale-column")).toBeTruthy();
  });

  it("las lineas se llevan el espacio libre y el CTA queda dentro del panel", () => {
    stubViewport(true);
    renderWorkspace({ sale: { canCharge: true, total: 100 } });

    const venta = screen.getByTestId("pos-sale-pane");
    expect(venta.querySelector(".flex-1.overflow-y-auto")).not.toBeNull();
    expect(venta.contains(screen.getByRole("button", { name: /^Cobrar / }))).toBe(true);
  });

  it("a 1280 no dibuja la barra del celular", () => {
    stubViewport(true);
    renderWorkspace();

    expect(screen.queryByRole("region", { name: "Resumen de la venta" })).toBeNull();
  });

  it("en celular la venta arranca cerrada y sin formulario, y la barra inferior la abre", async () => {
    stubViewport(false);
    const user = userEvent.setup();
    renderWorkspace();

    const cerrado = screen.getByTestId("pos-sale-pane");
    expect(cerrado.hasAttribute("open")).toBe(false);
    expect(screen.queryByLabelText("Nombre del cliente")).toBeNull();

    expect(screen.getByRole("region", { name: "Resumen de la venta" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Ver venta/ }));

    const abierto = screen.getByTestId("pos-sale-pane");
    expect(abierto.hasAttribute("open")).toBe(true);
    expect(screen.getByLabelText("Nombre del cliente")).toBeTruthy();
  });

  it("el sheet se cierra y el foco vuelve al disparador", async () => {
    stubViewport(false);
    const user = userEvent.setup();
    renderWorkspace();

    const abrir = screen.getByRole("button", { name: /Ver venta/ });
    await user.click(abrir);

    expect(screen.queryByRole("region", { name: "Resumen de la venta" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Cerrar venta" }));

    expect(screen.getByTestId("pos-sale-pane").hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Ver venta/ }));
  });

  it("con el sheet abierto, Escape lo cierra", async () => {
    stubViewport(false);
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: /Ver venta/ }));
    expect(screen.getByTestId("pos-sale-pane").hasAttribute("open")).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("pos-sale-pane").hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Ver venta/ }));
  });

  it("el resumen del celular muestra el conteo y el total de la venta", () => {
    stubViewport(false);
    renderWorkspace({
      sale: {
        lines: [{ productId: "p1", name: "Taco", unitPrice: 50, quantity: 2 }],
        totals: { subtotal: 100, packagingAmount: 0, total: 100 },
        total: 100,
      },
    });

    const barra = screen.getByRole("region", { name: "Resumen de la venta" });
    expect(barra.textContent).toContain("1 producto");
    expect(barra.textContent).toContain("2 unidades");
    expect(screen.getByRole("button", { name: /Ver venta · C\$/ })).toBeTruthy();
  });

  it("un error de catalogo no se lleva puesto el panel de venta", () => {
    stubViewport(true);
    renderWorkspace({ catalog: { loadError: "No se pudo cargar el catálogo de ese local." } });

    expect(screen.getByText("No se pudo cargar el catálogo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Venta en curso" })).toBeTruthy();
  });

  it("enviar un cobro llama a la accion de la pantalla una sola vez", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    const onCharge = vi.fn();

    renderWorkspace({ sale: { canCharge: true, total: 100, onCharge } });

    await user.click(screen.getByRole("button", { name: /^Cobrar / }));
    expect(onCharge).toHaveBeenCalledTimes(1);
  });
});
