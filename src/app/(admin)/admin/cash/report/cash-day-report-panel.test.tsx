// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { DayCloseLocationGroup, DayCloseTotals } from "@/modules/orders/domain/day-close";

import CashDayReportPanel from "./cash-day-report-panel";

/**
 * Tarea 1.5 del roadmap (2026-09-17) — el **reporte diario de caja**.
 *
 * Lo que fija: el día se puede cambiar por la URL (formulario `GET`, sin JavaScript), los números del día
 * salen de una sola vez y la comparación por sucursal muestra lo cobrado y cómo quedó cada caja. Y que un
 * día sin turnos lo diga en palabras, en vez de mostrar una tabla de ceros.
 */

const totals: DayCloseTotals = {
  shifts: 3,
  closed: 2,
  open: 1,
  withoutCount: 1,
  cashSales: 4000,
  cardSales: 1500,
  transferSales: 500,
  otherSales: 0,
  collected: 6000,
  tips: 120,
  movements: -200,
  refunds: -50,
  expected: 3750,
  counted: 3600,
  difference: -150,
};

const groups: DayCloseLocationGroup[] = [
  {
    locationId: "loc_centro",
    locationName: "Camino de Oriente",
    totals: { ...totals, shifts: 2, collected: 5000, cashSales: 3000 },
  },
  {
    locationId: "loc_masaya",
    locationName: "Carretera Masaya",
    totals: { ...totals, shifts: 1, collected: 1000, cashSales: 1000 },
  },
];

const props = { date: "2026-09-17", today: "2026-09-17", currency: { symbol: "C$", locale: "es-NI" } };

describe("CashDayReportPanel", () => {
  afterEach(cleanup);

  it("muestra los totales del día por medio y el arqueo", () => {
    render(<CashDayReportPanel groups={groups} totals={totals} {...props} />);

    const panel = screen.getByRole("region", { name: "Reporte de caja del día" });

    expect(panel.textContent).toContain("C$6,000.00");
    expect(panel.textContent).toContain("Efectivo");
    expect(panel.textContent).toContain("C$4,000.00");
    expect(panel.textContent).toContain("C$1,500.00");
    expect(panel.textContent).toContain("Propinas");
    expect(panel.textContent).toContain("-C$150.00");
    expect(panel.textContent).toContain("3 turnos");
    expect(panel.textContent).toContain("1 con la caja abierta");
  });

  it("compara las sucursales con lo que cobró cada una", () => {
    render(<CashDayReportPanel groups={groups} totals={totals} {...props} />);

    const filas = screen.getAllByRole("listitem");

    expect(filas[0]?.textContent).toContain("Camino de Oriente");
    expect(filas[0]?.textContent).toContain("C$5,000.00");
    expect(filas[1]?.textContent).toContain("Carretera Masaya");
  });

  it("el día se cambia con un formulario GET (sin JavaScript)", () => {
    render(<CashDayReportPanel groups={groups} totals={totals} {...props} />);

    const form = screen.getByRole("button", { name: "Ver el día" }).closest("form");

    expect(form?.getAttribute("method")).toBe("get");
    expect((screen.getByLabelText("Día") as HTMLInputElement).value).toBe("2026-09-17");
    expect((screen.getByLabelText("Día") as HTMLInputElement).max).toBe("2026-09-17");
  });

  it("un día sin turnos lo dice, en vez de mostrar una tabla de ceros", () => {
    render(
      <CashDayReportPanel
        groups={[{ locationId: "loc_centro", locationName: "Camino de Oriente", totals: { ...totals, shifts: 0, collected: 0 } }]}
        totals={{ ...totals, shifts: 0, closed: 0, open: 0, withoutCount: 0, collected: 0 }}
        {...props}
      />,
    );

    expect(screen.getByText(/No hubo turnos de caja ese día/)).toBeTruthy();
  });
});
