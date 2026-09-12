// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import { PickupPreviewPanel } from "./pickup-preview";

/**
 * Fase 2 del checkout — el panel de vista previa.
 *
 * Se prueba con un "ahora" fijo (el panel lo acepta como prop, igual que las funciones
 * de dominio): si dependiera del reloj real, el test diría cosas distintas según la
 * hora a la que se corra.
 */
function hours(open: string, close: string, closed = false): BusinessHours {
  return {
    mon: { open, close, closed },
    tue: { open, close, closed },
    wed: { open, close, closed },
    thu: { open, close, closed },
    fri: { open, close, closed },
    sat: { open, close, closed },
    sun: { open, close, closed },
  };
}

const base = {
  businessHours: hours("12:00", "22:00"),
  timezone: "America/Managua",
  pickupLeadMinutes: 25,
  pickupMaxMinutes: null,
  /** Sábado 12/09/2026, 12:00 en Managua. */
  now: new Date("2026-09-12T18:00:00.000Z"),
};

describe("PickupPreviewPanel", () => {
  afterEach(cleanup);

  it("muestra los turnos y la última orden, como los ve el cliente", () => {
    render(<PickupPreviewPanel {...base} />);

    expect(screen.getByText("Así lo ve el cliente")).toBeTruthy();
    expect(screen.getByText(/Lo antes posible · listo ~12:25 p\. m\./)).toBeTruthy();
    expect(screen.getByText("12:30 p. m.")).toBeTruthy();
    expect(screen.getByText("2:30 p. m.")).toBeTruthy();
    expect(screen.getByText("9:35 p. m.")).toBeTruthy();
  });

  it("con el local cerrado lo dice en vez de mostrar turnos", () => {
    render(<PickupPreviewPanel {...base} businessHours={hours("12:00", "22:00", true)} />);

    expect(screen.getByText(/Hoy el local está cerrado/)).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("si ya no quedan turnos, avisa sin dejar el panel vacío", () => {
    render(
      <PickupPreviewPanel {...base} now={new Date("2026-09-13T03:50:00.000Z")} />,
    );

    expect(screen.getByText(/Hoy ya no quedan turnos/)).toBeTruthy();
    // La última orden del día no cambia por la hora: es el cierre menos la preparación.
    expect(screen.getByText("9:35 p. m.")).toBeTruthy();
  });
});
