import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ReservationSuccessView from "./reservation-success-view";

describe("reservation success view", () => {
  it("renders the minimal mascot reservation confirmation contract", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationSuccessView, {
        reservation: {
          status: "approved",
          reservationNumber: "RSV-3B5886",
          date: "2026-06-14",
          time: "19:00",
          partySize: 2,
          tableLabel: "Mesa 1",
          customerName: "Daniel",
        },
      }),
    );

    expect(html).toContain("¡Reserva confirmada!");
    expect(html).toContain("Te esperamos en One Burger.");
    expect(html).toContain("Confirmada");
    expect(html).toContain("<img");
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("mascota-reserva");
    expect(html).toContain("Ver mis reservas");
    expect(html).toContain("Resumen de tu reserva");
    expect(html).toContain("Código de reserva");
    expect(html).toContain("RSV-3B5886");
    expect(html).toContain("domingo, 14 de junio");
    expect(html).toContain("7:00 p. m.");
    expect(html).toContain("2 personas");
    expect(html).toContain("Mesa 1");
    expect(html).toContain("Te enviaremos un recordatorio antes de tu reserva.");
    expect(html).toContain("Gracias por elegir One Burger.");
    expect(html).not.toContain("/brand/mascota-confirmacion.png");
    expect(html).not.toContain("Ver en Mi actividad");
    expect(html).not.toContain("Hacer otra reserva");
    expect(html).not.toContain("Daniel");
    expect(html).not.toContain("Cliente");

    expect(html.indexOf("<img")).toBeLessThan(
      html.indexOf("Ver mis reservas"),
    );
  });
});
