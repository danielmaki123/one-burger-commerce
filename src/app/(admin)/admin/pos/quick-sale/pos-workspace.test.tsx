// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import { PosWorkspace, type PosWorkspaceSale } from "./pos-workspace";
import { POS_TWO_PANE_QUERY } from "./use-media-query";

/**
 * El **workspace** de la venta rápida: `CATÁLOGO | VENTA`, la barra del celular y el sheet de checkout.
 *
 * Es la pieza que resuelve el problema que la Fase 1 vino a arreglar: el ticket no puede quedar varios
 * scrolls abajo. En escritorio el panel de venta es una columna `sticky`; en el celular la venta vive en un
 * sheet que se abre desde la barra inferior y, mientras está cerrado, **no hay formulario en el DOM** (los
 * campos se desmontan): un formulario invisible que se puede tabular es una trampa de teclado.
 *
 * El panel es un `<dialog>` nativo con el atributo `open`: en `lg` es la columna del layout y abajo de `lg`
 * el sheet del pie. No se usa `showModal()` a propósito (saca el nodo a la capa de arriba y rompería la
 * columna de escritorio ni `role="dialog"` a mano, que la ley del DS v4 prohíbe.
 *
 * El corte de dos paneles es `lg` (1024 px), el mismo número que usan las clases del layout. Se prueba con
 * `matchMedia` simulado porque jsdom no tiene media queries reales: lo que se verifica es la reacción del
 * componente, no el CSS.
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

/** La venta vacía, con la caja cerrada: el punto de partida de la pantalla. */
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
    canCharge: false,
    needsOpenShift: true,
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

function renderWorkspace(overrides: Partial<Parameters<typeof PosWorkspace>[0]> = {}) {
  const props: Parameters<typeof PosWorkspace>[0] = {
    contextBar: <p>Caja abierta · fondo C$100.00</p>,
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
    },
    sale: emptySale(),
    ...overrides,
  };

  return render(<PosWorkspace {...props} />);
}

describe("PosWorkspace", () => {
  it("el catálogo y la venta conviven como dos paneles en la misma pantalla", () => {
    stubViewport(true);
    renderWorkspace();

    expect(screen.getByRole("region", { name: "Catálogo" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Venta en curso" })).toBeTruthy();
  });

  it("el panel de venta se queda pegado mientras el catálogo scrollea", () => {
    stubViewport(true);
    renderWorkspace();

    const venta = screen.getByTestId("pos-sale-pane");
    // Anclado al viewport (no `sticky`: un `<dialog open>` con `sticky` no se pega) y con su propio scroll.
    expect(venta.className).toContain("lg:fixed");
    expect(venta.className).toContain("lg:max-h-[calc(100vh-2rem)]");
    // La columna que reserva el ancho existe en escritorio: sin ella el catálogo se comería el ancho.
    expect(screen.getByTestId("pos-sale-column")).toBeTruthy();
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

    // Con el sheet abierto la barra del celular no se dibuja: su lugar lo ocupa el botón de cobrar del
    // ticket, y dejarla encima taparía el CTA principal.
    expect(screen.queryByRole("region", { name: "Resumen de la venta" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Cerrar venta" }));

    expect(screen.getByTestId("pos-sale-pane").hasAttribute("open")).toBe(false);
    // La barra vuelve con el foco en su disparador (el botón se vuelve a montar donde estaba).
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Ver venta/ }),
    );
  });

  it("con el sheet abierto, Escape lo cierra", async () => {
    stubViewport(false);
    const user = userEvent.setup();
    renderWorkspace();

    const disparador = screen.getByRole("button", { name: /Ver venta/ });
    await user.click(disparador);
    expect(screen.getByTestId("pos-sale-pane").hasAttribute("open")).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("pos-sale-pane").hasAttribute("open")).toBe(false);
    // La barra se vuelve a montar al cerrar: el foco está en **su** disparador, no en el nodo viejo.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Ver venta/ }));
  });

  it("el CTA de cobro vive adentro del panel de venta (no se pierde con el catálogo)", () => {
    stubViewport(true);
    renderWorkspace({ sale: emptySale({ canCharge: true, needsOpenShift: false, total: 100 }) });

    const panel = screen.getByTestId("pos-sale-pane");
    expect(panel.contains(screen.getByRole("button", { name: /^Cobrar / }))).toBe(true);
  });

  it("el resumen del celular muestra el conteo y el total de la venta", () => {
    stubViewport(false);
    renderWorkspace({
      sale: emptySale({
        lines: [{ productId: "p1", name: "Taco", unitPrice: 50, quantity: 2 }],
        totals: { subtotal: 100, packagingAmount: 0, total: 100 },
        total: 100,
      }),
    });

    const barra = screen.getByRole("region", { name: "Resumen de la venta" });
    expect(barra.textContent).toContain("1 producto");
    expect(barra.textContent).toContain("2 unidades");
    expect(screen.getByRole("button", { name: /Ver venta · C\$/ })).toBeTruthy();
  });

  it("la venta vacía en celular igual invita a abrir el ticket", () => {
    stubViewport(false);
    renderWorkspace();

    const barra = screen.getByRole("region", { name: "Resumen de la venta" });
    expect(barra.textContent).toContain("Sin productos");
    expect(screen.getByRole("button", { name: /Ver venta/ })).toBeTruthy();
  });

  it("un error de catálogo no se lleva puesto el panel de venta", () => {
    stubViewport(true);
    renderWorkspace({
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
        loadError: "No se pudo cargar el catálogo de ese local.",
        onRetry: () => {},
        currency,
        onAdd: () => {},
      },
    });

    expect(screen.getByText("No se pudo cargar el catálogo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Venta en curso" })).toBeTruthy();
  });

  it("enviar un cobro llama a la acción de la pantalla una sola vez", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    const onCharge = vi.fn();

    renderWorkspace({
      sale: emptySale({ canCharge: true, needsOpenShift: false, total: 100, onCharge }),
    });

    await user.click(screen.getByRole("button", { name: /^Cobrar / }));
    expect(onCharge).toHaveBeenCalledTimes(1);
  });
});
