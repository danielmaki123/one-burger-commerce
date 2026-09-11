import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CartProvider } from "@/shared/lib/cart";

import CustomerActivityPage, {
  OrderDetailView,
  OrderHistoryCard,
} from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("../_components/order-tracking-session", () => ({
  useOrderTrackingSession: () => ({
    trackingWhatsapp: "",
    setTrackingWhatsapp: vi.fn(),
  }),
}));

describe("public activity page", () => {
  it("renders the order history header, single tab and empty orders state", () => {
    // El historial ahora puede repetir un pedido, así que vive dentro del carrito.
    const html = renderToStaticMarkup(
      createElement(CartProvider, { children: createElement(CustomerActivityPage) }),
    );

    expect(html).toContain("Historial");
    expect(html).toContain("Revisá tus pedidos recientes.");
    expect(html).toContain("Pedidos");
    expect(html).not.toContain("Reservas");
    expect(html).toContain("Pedidos recientes");
    expect(html).toContain("Aún no tenés pedidos");
    expect(html).toContain(
      "Cuando hagás un pedido, aparecerá aquí para que podás darle seguimiento.",
    );
    expect(html).toContain("Ver menú");
    expect(html).not.toContain("Mi actividad");
    expect(html).not.toContain("Pedidos activos");
    expect(html).not.toContain("Reservas activas");
    expect(html).not.toContain("Estado guardado");
    expect(html).not.toContain("Token seguro disponible");
    expect(html).not.toContain("Ver pedido");
  });

  it("renders a clean order detail without technical tracking copy", () => {
    const html = renderToStaticMarkup(
      createElement(OrderDetailView, {
        order: {
          orderNumber: "P-MQFU12MS",
          type: "pickup",
          status: "new",
          statusLabel: "Nueva",
          updatedAt: "2026-06-15T23:27:00.000Z",
          createdAt: "2026-06-15T23:20:00.000Z",
          total: 3541.75,
          orderLookupToken: "token",
        },
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain("P-MQFU12MS");
    expect(html).toContain("Recibida");
    expect(html).toContain("Estado del pedido");
    expect(html).toContain("Resumen del pedido");
    expect(html).toContain("Volver al historial");
    expect(html).not.toContain("Token seguro disponible");
    expect(html).not.toContain("Ver pedido");
  });

  it("la tarjeta del historial muestra datos reales y un timeline con progreso (T7)", () => {
    const html = renderToStaticMarkup(
      createElement(OrderHistoryCard, {
        order: {
          orderNumber: "P-MSRQ2Z2X",
          type: "pickup",
          status: "preparing",
          statusLabel: "Preparando",
          updatedAt: "2026-08-24T19:30:00.000Z",
          createdAt: "2026-08-24T19:10:00.000Z",
          total: 467.5,
          pickupTime: "2026-08-24T19:50:00.000Z",
          pickupScheduled: false,
          items: [
            {
              productId: "seed-prod-01",
              productName: "Taco de Birria",
              quantity: 2,
              unitPrice: 35,
              packagingUnitAmount: 0,
              modifierOptionIds: [],
              modifiers: [],
              lineTotal: 70,
            },
          ],
        },
        onOpen: vi.fn(),
        onReorder: vi.fn(),
      }),
    );

    expect(html).toContain("P-MSRQ2Z2X");
    expect(html).toContain("Preparando");
    expect(html).toContain("Retiro");
    expect(html).toContain("C$467.50");
    // El resumen sale de las líneas guardadas, no de un plato escrito a mano.
    expect(html).toContain("2 × Taco de Birria");
    expect(html).not.toContain("Sangría");
    expect(html).not.toContain("Aperol");
    // Timeline real, con progreso explícito.
    expect(html).toContain("Paso 3 de 5");
    expect(html).toContain("En preparación");
    // Estimado de retiro, aproximado porque no se programó.
    expect(html).toContain("Listo ~1:50 p. m.");
    // Las dos acciones con su nombre real.
    expect(html).toContain("Ver recibo");
    expect(html).toContain("Pedir nuevamente");
    expect(html).not.toContain("Volver a pedir");
    expect(html).not.toContain("Estado y total guardados");
  });

  it("un pedido viejo sin líneas no ofrece repetir (T7)", () => {
    // Los pedidos guardados antes de T7 no tienen ítems: se ven, no se repiten.
    const html = renderToStaticMarkup(
      createElement(OrderHistoryCard, {
        order: {
          orderNumber: "P-VIEJO1",
          type: "pickup",
          status: "closed",
          statusLabel: "Completada",
          updatedAt: "2026-08-24T19:30:00.000Z",
          total: 100,
        },
        onOpen: vi.fn(),
        onReorder: vi.fn(),
      }),
    );

    expect(html).toContain("Ver recibo");
    expect(html).not.toContain("Pedir nuevamente");
    expect(html).not.toContain("Sangría");
    // Pedido terminado: el timeline cierra sin paso "en curso".
    expect(html).toContain("Paso 5 de 5");
  });
});
