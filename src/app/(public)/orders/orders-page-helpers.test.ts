import { describe, expect, it } from "vitest";

import { formatPublicOrderUpdatedAt } from "./orders-page-helpers";

describe("formatPublicOrderUpdatedAt", () => {
  it("formatea la fecha en la zona del negocio", () => {
    expect(
      formatPublicOrderUpdatedAt("2026-06-28T17:42:00.000Z", "America/Managua"),
    ).toBe("28/6/2026, 11:42 a. m.");
  });

  /**
   * La zona estaba fija en Managua: un negocio en otra zona veía la hora corrida. Ahora la
   * decide la configuración.
   */
  it("la misma fecha en otra zona da otra hora", () => {
    expect(
      formatPublicOrderUpdatedAt("2026-06-28T17:42:00.000Z", "Asia/Tokyo"),
    ).toBe("29/6/2026, 2:42 a. m.");
  });
});
