import { describe, expect, it } from "vitest";

import { publicNotFoundContent } from "./not-found-content";

describe("public not-found content", () => {
  it("keeps the branded recovery actions available", () => {
    expect(publicNotFoundContent).toEqual({
      eyebrow: "One Burger",
      title: "Esta página no está disponible",
      description: "Volvé al inicio o explorá nuestra carta para seguir con tu visita.",
      primaryAction: { href: "/menu", label: "Ver menú" },
      secondaryAction: { href: "/", label: "Ir al inicio" },
    });
  });
});
