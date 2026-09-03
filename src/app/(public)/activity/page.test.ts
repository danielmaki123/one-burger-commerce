import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import CustomerActivityPage, {
  OrderDetailView,
  OrderHistoryCard,
  ReservationDetailView,
  ReservationHistoryCard,
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
  it("renders the history header, focused tabs and empty orders state", () => {
    const html = renderToStaticMarkup(createElement(CustomerActivityPage));

    expect(html).toContain("Historial");
    expect(html).toContain(
      "Revisá tus pedidos y reservas recientes.",
    );
    expect(html).toContain("Pedidos");
    expect(html).toContain("Reservas");
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

  it("renders a clean reservation detail", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationDetailView, {
        reservation: {
          reservationNumber: "R-7XK29P",
          reservationLookupToken: "token",
          status: "approved",
          date: "2026-06-15",
          time: "19:00",
          partySize: 2,
          tableLabel: "Mesa 4 · Terraza",
          updatedAt: "2026-06-15T23:27:00.000Z",
        },
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain("R-7XK29P");
    expect(html).toContain("Confirmada");
    expect(html).toContain("Estado de la reserva");
    expect(html).toContain("Detalles de la reserva");
    expect(html).toContain("Volver al historial");
    expect(html).not.toContain("Ver detalle");
  });

  it("renders order history cards with mock-aligned summary layout", () => {
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
        },
        onOpen: vi.fn(),
      }),
    );

    expect(html).toContain("P-MSRQ2Z2X");
    expect(html).toContain("Preparando");
    expect(html).toContain("Retiro");
    expect(html).toContain("C$467.50");
    expect(html).toContain("Volver a pedir");
    expect(html).toContain("Hoy");
    expect(html).toContain("mini-steps");
    expect(html).not.toContain("Estado y total guardados");
    expect(html).not.toContain("Abrí el detalle para revisar el seguimiento.");
    expect(html).not.toContain("›");
  });

  it("renders reservation history cards with compact facts and action", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationHistoryCard, {
        reservation: {
          reservationNumber: "T-MSRQEQS2",
          status: "approved",
          date: "2026-08-24",
          time: "19:30",
          partySize: 2,
          tableLabel: "Terraza · Mesa 12",
          updatedAt: "2026-08-24T19:30:00.000Z",
        },
        onOpen: vi.fn(),
      }),
    );

    expect(html).toContain("T-MSRQEQS2");
    expect(html).toContain("Confirmada");
    expect(html).toContain("Terraza");
    expect(html).toContain("Mesa 12");
    expect(html).toContain("Volver a pedir");
    expect(html).toContain("mini-steps");
    expect(html).not.toContain("Personas");
    expect(html).not.toContain("Mesa / área");
  });
});
