import { describe, expect, it } from "vitest";

import {
  getOrderStatusProgress,
  getReservationStatusProgress,
  ORDER_PROGRESS_STEPS,
  RESERVATION_PROGRESS_STEPS,
} from "./activity-status";

describe("activity status mappings", () => {
  it("maps order statuses to public labels and steps", () => {
    expect(getOrderStatusProgress("new")).toMatchObject({ label: "Recibida", stepIndex: 0 });
    expect(getOrderStatusProgress("confirmed")).toMatchObject({ label: "Aceptada", stepIndex: 1 });
    expect(getOrderStatusProgress("accepted")).toMatchObject({ label: "Aceptada", stepIndex: 1 });
    expect(getOrderStatusProgress("preparing")).toMatchObject({
      label: "En preparacion",
      stepIndex: 2,
    });
    expect(getOrderStatusProgress("ready")).toMatchObject({ label: "Lista", stepIndex: 3 });
    expect(getOrderStatusProgress("delivered")).toMatchObject({
      label: "Completada",
      stepIndex: 4,
    });
    expect(getOrderStatusProgress("closed")).toMatchObject({
      label: "Completada",
      stepIndex: 4,
    });
    expect(getOrderStatusProgress("picked_up")).toMatchObject({
      label: "Completada",
      stepIndex: 4,
    });
    expect(getOrderStatusProgress("served")).toMatchObject({
      label: "Completada",
      stepIndex: 4,
    });
    expect(getOrderStatusProgress("cancelled")).toMatchObject({
      label: "Cancelada",
      isTerminalNegative: true,
    });
  });

  it("maps reservation statuses to public labels and steps", () => {
    expect(getReservationStatusProgress("requested")).toMatchObject({
      label: "Solicitada",
      stepIndex: 0,
    });
    expect(getReservationStatusProgress("approved")).toMatchObject({
      label: "Confirmada",
      stepIndex: 1,
    });
    expect(getReservationStatusProgress("seated")).toMatchObject({
      label: "Completada",
      stepIndex: 1,
    });
    expect(getReservationStatusProgress("cancelled")).toMatchObject({
      label: "Cancelada",
      isTerminalNegative: true,
    });
    expect(getReservationStatusProgress("rejected")).toMatchObject({
      label: "Rechazada",
      isTerminalNegative: true,
    });
    expect(getReservationStatusProgress("no_show")).toMatchObject({
      label: "No asistio",
      isTerminalNegative: true,
    });
  });

  it("keeps step definitions stable", () => {
    expect(ORDER_PROGRESS_STEPS).toEqual([
      "Recibida",
      "Aceptada",
      "En preparacion",
      "Lista",
      "Completada",
    ]);
    expect(RESERVATION_PROGRESS_STEPS).toEqual(["Solicitada", "Confirmada"]);
  });
});
