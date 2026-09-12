// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/shared/lib/cart";
import {
  BusinessSettingsProvider,
  FALLBACK_BUSINESS_SETTINGS,
} from "@/shared/lib/business-settings";

import CheckoutPage from "./page";

/**
 * Reloj fijo: viernes 19:00 en Managua, dentro del horario por defecto (12:00-22:00).
 * El estado operativo haría que los tests dependieran de la hora a la que se corran.
 */
const PINNED_NOW = new Date("2026-09-11T19:00:00-06:00");

const push = vi.fn();

let mockCart: {
  items: CartItem[];
  subtotal: number;
  clearCart: ReturnType<typeof vi.fn>;
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/shared/lib/cart", () => ({
  useCart: () => mockCart,
}));

const twoItems: CartItem[] = [
  {
    productId: "prod-1",
    productName: "Hamburguesa Clásica",
    quantity: 1,
    unitPrice: 200,
    packagingUnitAmount: 10,
    packagingTotalAmount: 10,
    modifierOptionIds: [],
    lineTotal: 200,
  },
  {
    productId: "prod-2",
    productName: "Papas Fritas",
    quantity: 2,
    unitPrice: 80,
    packagingUnitAmount: 5,
    packagingTotalAmount: 10,
    modifierOptionIds: [],
    lineTotal: 160,
  },
];

function countMatches(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

function confirmButtons() {
  return screen.getAllByRole("button", { name: /Confirmar pedido/ });
}

/**
 * La llamada del pedido. El checkout también pide `/api/locations` al montar (T8), así que
 * contar llamadas a `fetch` ya no sirve para saber si se envió el pedido.
 */
function orderRequest(calls: unknown[][]): RequestInit {
  const call = calls.find(([url]) => url === "/api/orders");

  return (call?.[1] ?? {}) as RequestInit;
}

describe("checkout sin redundancias", () => {
  // Sin esto el DOM se acumula entre tests y las consultas por `screen` ven
  // elementos de la corrida anterior (el repo no usa `globals: true`).
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  beforeEach(() => {
    push.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PINNED_NOW);
    mockCart = { items: [], subtotal: 0, clearCart: vi.fn() };
    vi.stubGlobal("fetch", vi.fn());
  });

  it("con el carrito vacío muestra el estado compartido", () => {
    render(<CheckoutPage />);

    expect(screen.getByText("Tu carrito está vacío")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver menú" })).toBeTruthy();
  });

  it("dice cada cosa una sola vez", () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    const { container } = render(<CheckoutPage />);
    const html = container.innerHTML;

    expect(countMatches(html, "Confirmá tu pedido")).toBe(1);
    expect(countMatches(html, "Resumen del pedido")).toBe(1);
    expect(countMatches(html, "Subtotal")).toBe(1);
    expect(countMatches(html, "Empaque")).toBe(1);
    // El total, una sola vez: el importe del CTA no repite la fila "Total a pagar".
    expect(countMatches(html, "Total a pagar")).toBe(1);
    // En el DOM hay un CTA por viewport; visible queda uno solo (lo verifica el E2E,
    // que es el único que puede evaluar el CSS).
    expect(confirmButtons()).toHaveLength(2);

    // Lo que se fue con la limpieza.
    expect(html).not.toContain("Tu bolsa");
    expect(html).not.toContain("Total estimado");
    expect(html).not.toContain("Listo para confirmar");
    expect(html).not.toContain("Paso final");
    expect(html).not.toContain("Número de mesa");
    expect(html).not.toContain("Mesa");
    expect(html).not.toContain("Delivery");
  });

  it("muestra el CTA de escritorio y el de móvil en contenedores exclusivos", () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    const { container } = render(<CheckoutPage />);

    // Sin esto, los dos CTA quedan visibles a la vez en algún ancho de pantalla.
    expect(container.querySelectorAll(".hidden.lg\\:block").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".lg\\:hidden").length).toBeGreaterThan(0);
  });

  it("lista el pedido completo, no solo el primer producto", () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(<CheckoutPage />);

    expect(screen.getAllByText("Hamburguesa Clásica").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Papas Fritas").length).toBeGreaterThan(0);
    expect(screen.getByText("3 productos")).toBeTruthy();
  });

  it("avisa cómo se paga una sola vez y con el texto del negocio", () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    const { container } = render(<CheckoutPage />);

    expect(
      countMatches(container.innerHTML, "Pagás en el local al retirar tu pedido."),
    ).toBe(1);
  });

  it("no arranca con el botón deshabilitado", () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(<CheckoutPage />);

    for (const button of confirmButtons()) {
      expect(button.hasAttribute("disabled")).toBe(false);
    }
  });

  it("al tocar con datos faltantes señala el campo, lo enfoca y muestra un solo aviso", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(<CheckoutPage />);
    await user.click(confirmButtons()[0]);

    const messages = screen.getAllByText("Falta completar nombre.");
    expect(messages).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));
    // No se manda el pedido. (`/api/locations` sí se pide al montar: es la lectura del
    // punto de retiro, no el envío.)
    expect(fetch).not.toHaveBeenCalledWith("/api/orders", expect.anything());
  });

  it("arranca sin programar el retiro", async () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText(/^Lo antes posible · listo ~/)).toBeTruthy();
    });
    // Los turnos no se ofrecen hasta abrir el control (los radios de la forma de
    // pago son otra cosa y sí están).
    expect(screen.queryByRole("radio", { name: /Lo antes posible/ })).toBeNull();
  });

  it("deja elegir la forma de pago y arranca en efectivo (T11)", async () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    const user = userEvent.setup();

    render(<CheckoutPage />);

    const cash = screen.getByRole("radio", { name: "Efectivo" }) as HTMLInputElement;
    const card = screen.getByRole("radio", { name: "Tarjeta" }) as HTMLInputElement;

    // El cobro es en el local: lo más probable es efectivo, y el cliente puede cambiarlo.
    expect(cash.checked).toBe(true);
    expect(card.checked).toBe(false);

    await user.click(card);
    expect(card.checked).toBe(true);
    expect(cash.checked).toBe(false);

    // Y la copia de cómo se paga sigue apareciendo una sola vez (vive en el resumen).
    const { container } = render(<CheckoutPage />);
    expect(countMatches(container.innerHTML, "Pagás en el local al retirar tu pedido.")).toBe(1);
  });

  it("con rango configurado promete una franja y muestra dónde se retira (T5)", async () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(
      <BusinessSettingsProvider
        settings={{
          ...FALLBACK_BUSINESS_SETTINGS,
          pickupLeadMinutes: 15,
          pickupMaxMinutes: 35,
          addressLine: "Frente al parque central",
          city: "Jinotepe",
          mapsUrl: "https://maps.test/one-burger",
        }}
      >
        <CheckoutPage />
      </BusinessSettingsProvider>,
    );

    // El cliente ve una franja, no un instante que la cocina puede fallar.
    expect(await screen.findByText(/^Lo antes posible · listo entre /)).toBeTruthy();
    // Y dónde se retira, con el enlace al mapa configurado.
    expect(screen.getByText("Frente al parque central, Jinotepe")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Cómo llegar/ })).toHaveProperty(
      "href",
      "https://maps.test/one-burger",
    );
  });

  it("sin dirección configurada no inventa la fila del punto de retiro (T5)", async () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(
      <BusinessSettingsProvider
        settings={{ ...FALLBACK_BUSINESS_SETTINGS, addressLine: null, city: null, addressReference: null }}
      >
        <CheckoutPage />
      </BusinessSettingsProvider>,
    );

    await screen.findByText(/^Lo antes posible · listo /);
    expect(screen.queryByText("Retirás en")).toBeNull();
  });

  it("bloquea el pedido cuando el negocio no está aceptando pedidos", () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(
      <BusinessSettingsProvider
        settings={{
          ...FALLBACK_BUSINESS_SETTINGS,
          isAcceptingOrders: false,
          closedMessage: "Cerrado por hoy, volvemos mañana.",
        }}
      >
        <CheckoutPage />
      </BusinessSettingsProvider>,
    );

    for (const button of confirmButtons()) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
    // Un solo aviso, y con el texto que configuró el negocio.
    expect(screen.getAllByText("Cerrado por hoy, volvemos mañana.")).toHaveLength(1);
    // No se ofrecen turnos que no se pueden usar.
    expect(screen.queryByRole("button", { name: /^Lo antes posible/ })).toBeNull();
  });

  it("con el local por cerrar todavía se puede pedir lo antes posible", () => {
    // 21:20 con cierre 22:00 y 25 min de preparación: ya no quedan turnos de la grilla,
    // pero el pedido entra 21:45, dentro del horario. Bloquearlo era el checkout siendo
    // más estricto que el servidor.
    vi.setSystemTime(new Date("2026-09-11T21:20:00-06:00"));
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(<CheckoutPage />);

    for (const button of confirmButtons()) {
      expect(button.hasAttribute("disabled")).toBe(false);
    }
    expect(screen.getByText(/^Lo antes posible · listo ~9:45 p\. m\./)).toBeTruthy();
  });

  it("bloquea el pedido cuando ya no quedan turnos hoy", () => {
    // Después del cierre (22:00): no hay turno posible, a diferencia de las 03:00,
    // donde el local todavía no abrió pero se puede pedir para la hora de apertura.
    vi.setSystemTime(new Date("2026-09-11T23:00:00-06:00"));
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    render(<CheckoutPage />);

    for (const button of confirmButtons()) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
    expect(
      screen.getAllByText(FALLBACK_BUSINESS_SETTINGS.closedMessage as string),
    ).toHaveLength(1);
  });

  it("sin programar no manda hora de retiro: la calcula el servidor", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubOrderResponse();

    render(<CheckoutPage />);
    await user.type(screen.getByLabelText("Nombre completo"), "Cliente E2E");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/orders", expect.anything()));

    const body = JSON.parse(
      orderRequest(vi.mocked(fetch).mock.calls).body as string,
    );
    expect(body.customerName).toBe("Cliente E2E");
    expect(body.type).toBe("pickup");
    // Mandar una hora calculada por el cliente la volvería una hora del pasado si el
    // formulario tarda: por eso "sin programar" es simplemente no mandarla.
    expect(body.pickupTime).toBeUndefined();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/success/order-1?token=token-1"));
  });

  it("el monto con el que paga solo aparece en efectivo y viaja con el pedido (T12)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubOrderResponse();

    render(<CheckoutPage />);

    // Con tarjeta no hay vuelto que calcular.
    await user.click(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.queryByLabelText(/Con cuánto vas a pagar/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Efectivo" }));
    const paidWith = screen.getByLabelText(/Con cuánto vas a pagar/);

    // El carrito de prueba: 360 de productos (200 + 2×80, sin empaque) + 20 de empaque = 380.
    await user.type(paidWith, "430");
    expect(screen.getByText(/Cambio estimado: C\$50\.00/)).toBeTruthy();

    // Un monto que no alcanza se avisa y no se manda.
    await user.clear(paidWith);
    await user.type(paidWith, "100");
    expect(screen.getByText(/Tiene que alcanzar para pagar el total/)).toBeTruthy();

    await user.clear(paidWith);
    await user.type(paidWith, "430");
    await user.type(screen.getByLabelText("Nombre completo"), "Cliente Efectivo");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/orders", expect.anything()));
    const body = JSON.parse(
      orderRequest(vi.mocked(fetch).mock.calls).body as string,
    );
    expect(body.paymentMethod).toBe("cash");
    expect(body.paidWithAmount).toBe(430);
  });

  it("valida el código de promo antes de confirmar y lo manda con el pedido (T9b)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    // El servidor dice que el código sirve y devuelve su forma pública.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("/api/coupons/validate")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                code: "B2G1",
                type: "bogo",
                value: 0,
                buyQuantity: 2,
                freeQuantity: 1,
                scopeType: "category",
                scopeId: "cat-tacos",
              },
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              id: "order-1",
              orderNumber: "OB-1",
              type: "pickup",
              status: "new",
              total: 380,
              subtotal: 360,
              orderLookupToken: "token-1",
            },
          }),
        });
      }),
    );

    render(<CheckoutPage />);

    await user.type(screen.getByLabelText("Código de promo"), "b2g1");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    // Se muestra el bloque completo y se avisa que el monto lo calcula el servidor.
    expect(await screen.findByText(/Código B2G1 aplicado · Llevá 3 y pagá 2/)).toBeTruthy();
    expect(screen.getByText(/el descuento se calcula al confirmar/)).toBeTruthy();

    // Y el código viaja en el pedido aunque el cliente no vuelva a tocar "Aplicar".
    await user.type(screen.getByLabelText("Nombre completo"), "Cliente Promo");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(push).toHaveBeenCalled());
    const orderCall = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes("/api/orders"));
    const body = JSON.parse((orderCall![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body.couponCode).toBe("b2g1");
  });

  it("un código que no sirve se avisa antes de confirmar (T9b)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "No encontramos ese código." } }),
      }),
    );

    render(<CheckoutPage />);

    await user.type(screen.getByLabelText("Código de promo"), "NOEXISTE");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByText("No encontramos ese código.")).toBeTruthy();
  });

  it("programar una hora la manda en el pedido", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubOrderResponse();

    render(<CheckoutPage />);

    // El control arranca mostrando el estado, no escondido.
    expect(screen.getByText(/^Lo antes posible · listo ~/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Lo antes posible · listo/ }));
    await user.click(screen.getByRole("radio", { name: "8:00 p. m." }));

    await user.type(screen.getByLabelText("Nombre completo"), "Cliente E2E");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/orders", expect.anything()));

    const body = JSON.parse(
      orderRequest(vi.mocked(fetch).mock.calls).body as string,
    );
    // El instante exacto: 8:00 p. m. del viernes 11 en Managua (UTC-6) son las 02:00 UTC del
    // 12. Antes esto se afirmaba con `getHours()`, o sea en la zona del equipo que corre el
    // test: pasaba en una máquina en UTC-6 y fallaba en CI (UTC) con "expected 2 to be 20".
    expect(body.pickupTime).toBe("2026-09-12T02:00:00.000Z");
  });

  /**
   * Gap del total con varios locales: el servidor cobra con el local elegido y el checkout
   * mostraba los precios del carrito (los del menú que el cliente miró). Ahora re-preciá con
   * el menú que el servidor cotiza para ese local, y si el local no vende un plato, frena y
   * lo dice con nombres.
   */
  it("el total se re-precia con los precios del local elegido (T8)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubLocationsWithMenus({
      menusByLocation: {
        loc_norte: [
          {
            products: [
              { id: "prod-1", basePrice: 250, modifierGroups: [] },
              { id: "prod-2", basePrice: 100, modifierGroups: [] },
            ],
          },
        ],
      },
    });

    render(<CheckoutPage />);

    // Con el local por defecto, sin menú cotizado, se muestran los precios del carrito:
    // 360 + 20 de empaque = 380.
    await waitFor(() => expect(confirmButtons()[0].textContent).toContain("C$380.00"));

    await user.click(await screen.findByRole("radio", { name: /Norte/ }));

    // En el Norte: 250 + 2×100 = 450 de productos, + 20 de empaque = 470.
    await waitFor(() => expect(confirmButtons()[0].textContent).toContain("C$470.00"));
  });

  it("un local que no vende un plato del carrito frena la confirmación y lo nombra (T8)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubLocationsWithMenus({
      menusByLocation: {
        loc_norte: [{ products: [{ id: "prod-1", basePrice: 200, modifierGroups: [] }] }],
      },
    });

    render(<CheckoutPage />);
    await user.click(await screen.findByRole("radio", { name: /Norte/ }));

    expect(
      await screen.findByText(
        "En Norte no se vende: Papas Fritas. Cambiá de local o quitá esos platos del carrito.",
      ),
    ).toBeTruthy();
    await waitFor(() => expect(confirmButtons()[0].hasAttribute("disabled")).toBe(true));
    // No se manda nada: el servidor tampoco lo aceptaría.
    expect(fetch).not.toHaveBeenCalledWith("/api/orders", expect.anything());
  });

  /**
   * Un local cerrado **hoy** no puede ser un callejón sin salida: desde la fase 4 el cliente
   * puede pedir para otro día, así que el control de retiro tiene que seguir a la vista (antes
   * se escondía y solo quedaba el mensaje de "fuera de horario", sin forma de elegir un día).
   */
  it("con el local cerrado hoy se puede programar para otro día", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubOrderResponse();

    render(
      <BusinessSettingsProvider
        settings={{
          ...FALLBACK_BUSINESS_SETTINGS,
          // El reloj del test está fijado el viernes 2026-09-11: se cierra ese día.
          businessHours: {
            ...FALLBACK_BUSINESS_SETTINGS.businessHours,
            fri: { open: "12:00", close: "22:00", closed: true },
          },
        }}
      >
        <CheckoutPage />
      </BusinessSettingsProvider>,
    );

    // El control sigue a la vista y explica por qué hoy no se puede.
    const schedule = await screen.findByRole("button", { name: /^Retiro/ });
    expect(schedule).toBeTruthy();
    await user.click(schedule);
    expect(await screen.findByText(/Hoy no podemos preparar tu pedido/)).toBeTruthy();
    await waitFor(() => expect(confirmButtons()[0].hasAttribute("disabled")).toBe(true));

    // Se elige mañana (sábado, abierto): el día trae su primer turno y se puede confirmar.
    fireEvent.change(screen.getByLabelText("Día de retiro"), {
      target: { value: "2026-09-12" },
    });

    await waitFor(() => expect(confirmButtons()[0].hasAttribute("disabled")).toBe(false));
  });

  it("con un solo local no dibuja el selector y el retiro sale de ese local (T8)", async () => {
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubLocationsResponse([
      {
        id: "loc_principal",
        name: "Principal",
        addressLine: "Frente al parque",
        city: "Jinotepe",
        pickupLeadMinutes: 25,
        pickupMaxMinutes: null,
        isAcceptingOrders: true,
      },
    ]);

    render(<CheckoutPage />);

    expect(await screen.findByText("Frente al parque, Jinotepe")).toBeTruthy();
    // Un solo local = nada que elegir: el selector sería un control decorativo.
    expect(screen.queryByRole("radio", { name: /Principal/ })).toBeNull();
  });

  it("con varios locales deja elegir y manda el local del retiro (T8)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubLocationsResponse([
      {
        id: "loc_principal",
        name: "Principal",
        addressLine: "Frente al parque",
        city: "Jinotepe",
        pickupLeadMinutes: 25,
        pickupMaxMinutes: null,
        isAcceptingOrders: true,
      },
      {
        id: "loc_norte",
        name: "Norte",
        addressLine: "Carretera sur",
        city: "Diriamba",
        pickupLeadMinutes: 40,
        pickupMaxMinutes: null,
        isAcceptingOrders: true,
      },
    ]);

    render(<CheckoutPage />);

    const norte = await screen.findByRole("radio", { name: /Norte/ });
    await user.click(norte);

    // El punto de retiro es el del local elegido (el selector también muestra la dirección,
    // así que se mira la fila "Retirás en").
    const pickupRow = screen.getByText("Retirás en").parentElement as HTMLElement;
    expect(within(pickupRow).getByText("Carretera sur, Diriamba")).toBeTruthy();

    await user.type(screen.getByLabelText("Nombre completo"), "Cliente Local");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/orders", expect.anything()));
    const body = JSON.parse(orderRequest(vi.mocked(fetch).mock.calls).body as string);
    expect(body.locationId).toBe("loc_norte");
  });

  it("un local que dejó de recibir pedidos bloquea el checkout (T8)", async () => {    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubLocationsResponse([
      {
        id: "loc_principal",
        name: "Principal",
        addressLine: "Frente al parque",
        city: "Jinotepe",
        pickupLeadMinutes: 25,
        pickupMaxMinutes: null,
        isAcceptingOrders: false,
        closedMessage: "Volvemos mañana a las 12.",
      },
    ]);

    render(<CheckoutPage />);

    expect(await screen.findByText("Volvemos mañana a las 12.")).toBeTruthy();
  });

  /**
   * Fase 4 del checkout (D1) — pedidos para días futuros.
   *
   * El reloj está fijado el viernes 2026-09-11 a las 19:00 en Managua, así que "hoy" es el
   * 11. El día elegido decide los turnos y la hora que viaja en el pedido, y "lo antes
   * posible" solo existe para hoy: para otro día hay que elegir una hora.
   */
  it("elegir otro día muestra los turnos de ese día y manda su hora (D1)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubOrderResponse();

    render(<CheckoutPage />);

    await user.click(await screen.findByRole("button", { name: /Lo antes posible · listo/ }));

    const dayInput = screen.getByLabelText("Día de retiro") as HTMLInputElement;
    expect(dayInput.value).toBe("2026-09-11");
    // No se puede pedir para ayer.
    expect(dayInput.min).toBe("2026-09-11");

    // Mañana (sábado 12): los turnos arrancan en la apertura, sin la espera de preparación
    // que empuja los de hoy.
    fireEvent.change(dayInput, { target: { value: "2026-09-12" } });

    expect(screen.queryByRole("radio", { name: /Lo antes posible/ })).toBeNull();
    expect(screen.getByRole("radio", { name: "12:00 p. m." })).toBeTruthy();
    // El control plegado dice el día, no solo la hora.
    expect(screen.getByText(/^Retiro programado/)).toBeTruthy();
    expect(screen.getByText(/Mañana · 12:00 p\. m\./)).toBeTruthy();

    await user.type(screen.getByLabelText("Nombre completo"), "Cliente Futuro");
    await user.type(screen.getByLabelText("WhatsApp"), "88887777");
    await user.click(confirmButtons()[0]);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/orders", expect.anything()));

    const body = JSON.parse(
      orderRequest(vi.mocked(fetch).mock.calls).body as string,
    );
    // 12:00 del 12 de septiembre en Managua (UTC-6) = 18:00 UTC. La hora se resuelve en la
    // zona del negocio, no en la del equipo que corre el test.
    expect(body.pickupTime).toBe("2026-09-12T18:00:00.000Z");
  });

  it("un día que el negocio no atiende no deja confirmar (D1)", async () => {
    const user = userEvent.setup();
    mockCart = { items: twoItems, subtotal: 360, clearCart: vi.fn() };
    stubOrderResponse();

    render(
      <BusinessSettingsProvider
        settings={{
          ...FALLBACK_BUSINESS_SETTINGS,
          // Domingo cerrado: el 13 de septiembre cae domingo.
          businessHours: {
            ...FALLBACK_BUSINESS_SETTINGS.businessHours,
            sun: { open: "12:00", close: "22:00", closed: true },
          },
        }}
      >
        <CheckoutPage />
      </BusinessSettingsProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /Lo antes posible · listo/ }));
    fireEvent.change(screen.getByLabelText("Día de retiro"), {
      target: { value: "2026-09-13" },
    });

    // Se explica por qué no se puede, en vez de dejar un botón que falle al confirmar.
    expect(await screen.findByText("Ese día no atendemos. Elegí otro día.")).toBeTruthy();
    expect((confirmButtons()[0] as HTMLButtonElement).disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalledWith("/api/orders", expect.anything());
  });
});

function stubOrderResponse() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "order-1",
          orderNumber: "OB-1",
          type: "pickup",
          status: "new",
          total: 380,
          subtotal: 360,
          orderLookupToken: "token-1",
        },
      }),
    }),
  );
}

/**
 * Checkout con locales y el menú que el servidor cotiza para cada uno (`?locationId=`).
 * Sin `menusByLocation` ese local queda sin menú cotizado y se usan los precios del carrito.
 */
function stubLocationsWithMenus(options: {
  menusByLocation?: Record<string, unknown[]>;
  locations?: Record<string, unknown>[];
}) {
  const locations = options.locations ?? [
    {
      id: "loc_principal",
      name: "Principal",
      addressLine: "Frente al parque",
      city: "Jinotepe",
      pickupLeadMinutes: 25,
      pickupMaxMinutes: null,
      isAcceptingOrders: true,
    },
    {
      id: "loc_norte",
      name: "Norte",
      addressLine: "Carretera sur",
      city: "Diriamba",
      pickupLeadMinutes: 40,
      pickupMaxMinutes: null,
      isAcceptingOrders: true,
    },
  ];

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const target = String(url);

      if (target === "/api/locations") {
        return Promise.resolve({ ok: true, json: async () => ({ data: locations }) });
      }

      if (target.startsWith("/api/menu?locationId=")) {
        const id = decodeURIComponent(target.split("=")[1] ?? "");
        return Promise.resolve({
          ok: true,
          json: async () => ({ categories: options.menusByLocation?.[id] ?? [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            id: "order-1",
            orderNumber: "OB-1",
            type: "pickup",
            status: "new",
            total: 380,
            subtotal: 360,
            orderLookupToken: "token-1",
          },
        }),
      });
    }),
  );
}

/**
 * El checkout pide los locales al montar (T8) y después manda el pedido. El horario se
 * completa con el de la configuración para no repetirlo en cada caso.
 */
function stubLocationsResponse(locations: Record<string, unknown>[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url) === "/api/locations") {
        return Promise.resolve({ ok: true, json: async () => ({ data: locations }) });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            id: "order-1",
            orderNumber: "OB-1",
            type: "pickup",
            status: "new",
            total: 380,
            subtotal: 360,
            orderLookupToken: "token-1",
          },
        }),
      });
    }),
  );
}
