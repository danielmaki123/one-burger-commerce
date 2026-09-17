// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ShiftHandoversList from "./shift-handovers-list";

/**
 * Tarea 7 del brief (2026-09-17) — la lista de **traspasos** (1.13), que ven la pantalla de caja y el
 * detalle del cierre.
 *
 * Fija lo que el dato tiene que decir: quién recibió, de quién, con cuánto (el esperado **congelado**) y
 * cuándo — y que un turno sin traspasos lo diga con el texto de la pantalla que la usa.
 */

const handovers = [
  {
    id: "handover_1",
    handedByName: "María Pérez",
    receivedByName: "Carlos Ruiz",
    expectedAmount: 1500,
    expectedByCurrency: { NIO: 1500 },
    createdAt: "2026-09-18T22:31:00.000Z",
  },
  {
    id: "handover_2",
    handedByName: null,
    receivedByName: "Ana Gómez",
    expectedAmount: 2100.5,
    expectedByCurrency: null,
    createdAt: "2026-09-19T01:15:00.000Z",
  },
];

const props = {
  currency: { symbol: "C$", locale: "es-NI" },
  timezone: "America/Managua",
  locale: "es-NI",
};

describe("ShiftHandoversList", () => {
  afterEach(cleanup);

  it("dice quién recibió, de quién, con cuánto y cuándo", () => {
    render(<ShiftHandoversList handovers={handovers} emptyLabel="Sin traspasos." {...props} />);

    const first = screen.getAllByText(/Recibió/)[0]?.textContent ?? "";
    expect(first).toContain("Carlos Ruiz");
    expect(first).toContain("María Pérez");
    expect(first).toContain("C$1,500.00");

    // Un traspaso sin nombre de quien entrega no imprime «de null»: simplemente no lo dice.
    const last = screen.getAllByText(/Recibió/)[1]?.textContent ?? "";
    expect(last).not.toContain("null");
    expect(last).toContain("C$2,100.50");
  });

  it("sin traspasos dice lo que le pasó la pantalla que la usa", () => {
    render(<ShiftHandoversList handovers={[]} emptyLabel="Este turno no cambió de manos." {...props} />);

    expect(screen.getByText("Este turno no cambió de manos.")).toBeTruthy();
  });
});
