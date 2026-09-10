import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PublicHomePage from "./page";

describe("public home page", () => {
  it("no repite navegación: los accesos rápidos se retiraron", () => {
    const html = renderToStaticMarkup(createElement(PublicHomePage));

    // La navegación vive en el header y en la barra inferior del público; la
    // sección de accesos rápidos era una tercera copia de los mismos enlaces.
    expect(html).not.toContain("Accesos rápidos");
    expect(html).not.toContain("Ver carta");
    expect(html).not.toContain("Confirmar pedido");
  });

  it("no reintroduce módulos fuera del MVP", () => {
    const html = renderToStaticMarkup(createElement(PublicHomePage));

    expect(html).not.toContain("Reservar");
    expect(html).not.toContain("Mundial 2026");
  });
});
