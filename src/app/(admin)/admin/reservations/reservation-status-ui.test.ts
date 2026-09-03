import { describe, expect, it } from "vitest";

import {
  ADMIN_RESERVATION_STATUS_META,
  ADMIN_RESERVATION_TRANSITIONS,
  formatAdminReservationDate,
  formatAdminReservationTime,
} from "./reservation-status-ui";
import { getAdminReservationSolidStatus } from "../_components/admin-operational-ui";

describe("ADMIN_RESERVATION_STATUS_META", () => {
  it("presenta no_show en español con el tono compartido", () => {
    expect(ADMIN_RESERVATION_STATUS_META.no_show).toEqual({
      label: "No asistió",
      variant: "danger",
    });
  });
});

describe("getAdminReservationSolidStatus", () => {
  it("mapea los seis estados al vocabulario sólido del salón", () => {
    expect(getAdminReservationSolidStatus("requested")).toBe("nueva");
    expect(getAdminReservationSolidStatus("approved")).toBe("lista");
    expect(getAdminReservationSolidStatus("seated")).toBe("preparando");
    expect(getAdminReservationSolidStatus("cancelled")).toBe("cerrada");
    expect(getAdminReservationSolidStatus("rejected")).toBe("alerta");
    expect(getAdminReservationSolidStatus("no_show")).toBe("alerta");
  });

  it("cae en cerrada ante un estado desconocido", () => {
    expect(getAdminReservationSolidStatus("otro")).toBe("cerrada");
  });
});

describe("ADMIN_RESERVATION_TRANSITIONS", () => {
  it("requested solo puede aprobarse o rechazarse", () => {
    expect(ADMIN_RESERVATION_TRANSITIONS.requested).toEqual([
      "approved",
      "rejected",
    ]);
  });

  it("approved avanza a mesa o se cierra", () => {
    expect(ADMIN_RESERVATION_TRANSITIONS.approved).toEqual([
      "seated",
      "cancelled",
      "no_show",
    ]);
  });

  it("los estados terminales no tienen transiciones", () => {
    expect(ADMIN_RESERVATION_TRANSITIONS.seated).toEqual([]);
    expect(ADMIN_RESERVATION_TRANSITIONS.rejected).toEqual([]);
    expect(ADMIN_RESERVATION_TRANSITIONS.cancelled).toEqual([]);
    expect(ADMIN_RESERVATION_TRANSITIONS.no_show).toEqual([]);
  });
});

describe("formatAdminReservationDate", () => {
  it("formatea date-only a dd/mm/aaaa sin desfase de zona", () => {
    expect(formatAdminReservationDate("2026-08-04")).toBe("04/08/2026");
  });

  it("formatea ISO completo en la zona de Managua", () => {
    const formatted = formatAdminReservationDate("2026-08-04T02:00:00.000Z");
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it("devuelve el string original si no se puede parsear", () => {
    expect(formatAdminReservationDate("no-es-fecha")).toBe("no-es-fecha");
  });
});

describe("formatAdminReservationTime", () => {
  it("mantiene la hora en 24h tal cual", () => {
    expect(formatAdminReservationTime("19:30")).toBe("19:30");
  });
});
