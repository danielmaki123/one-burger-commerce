import { describe, expect, it } from "vitest";

import { classifyUpdateRoute } from "./update-routes";

describe("classifyUpdateRoute", () => {
  it("marca rutas seguras aprobadas", () => {
    expect(classifyUpdateRoute("/")).toBe("safe");
    expect(classifyUpdateRoute("/menu")).toBe("safe");
    expect(classifyUpdateRoute("/activity")).toBe("safe");
    expect(classifyUpdateRoute("/success/ord_1")).toBe("safe");
  });

  it("marca rutas criticas aprobadas", () => {
    expect(classifyUpdateRoute("/cart")).toBe("critical");
    expect(classifyUpdateRoute("/checkout")).toBe("critical");
    expect(classifyUpdateRoute("/reservations")).toBe("critical");
    expect(classifyUpdateRoute("/orders")).toBe("critical");
    expect(classifyUpdateRoute("/orders/track")).toBe("critical");
    expect(classifyUpdateRoute("/menu/prod_1")).toBe("critical");
  });

  it("deja otras rutas como neutrales", () => {
    expect(classifyUpdateRoute("/contact")).toBe("neutral");
  });
});
