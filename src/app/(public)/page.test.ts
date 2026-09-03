import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PublicHomePage from "./page";

describe("public home page", () => {
  it("renders pickup MVP quick actions below populares", () => {
    const html = renderToStaticMarkup(createElement(PublicHomePage));

    expect(html).toContain("Accesos rápidos");
    expect(html).toContain("Menú");
    expect(html).toContain("Carrito");
    expect(html).toContain("Contacto");
    expect(html).not.toContain("Reservar");
    expect(html).not.toContain("Mundial 2026");
  });
});
