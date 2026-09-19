// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ProductImageRecord } from "@/modules/menu/domain/menu.types";

import PosCatalogPhoto from "./pos-catalog-photo";

/**
 * La foto de la tarjeta del mostrador y su respaldo.
 *
 * El catálogo real apunta a un host externo (`images.casaantiguanic.com`) y un local nuevo puede no
 * tener fotos cargadas: los dos casos tienen que terminar en algo que se vea bien y no en un hueco con
 * el texto alternativo suelto.
 */

afterEach(cleanup);

const foto = (over: Partial<ProductImageRecord> = {}): ProductImageRecord => ({
  id: "img_1",
  url: "https://cdn.test/doble.png",
  alt: "DOBLE",
  sortOrder: 0,
  isPrimary: true,
  ...over,
});

describe("PosCatalogPhoto", () => {
  it("dibuja la foto con su texto alternativo", () => {
    render(<PosCatalogPhoto name="DOBLE" images={[foto()]} />);

    const image = screen.getByRole("img", { name: "DOBLE" });
    expect(image.getAttribute("src")).toBe("https://cdn.test/doble.png");
  });

  it("sin texto alternativo usa el nombre del producto", () => {
    render(<PosCatalogPhoto name="DOBLE" images={[foto({ alt: " " })]} />);

    expect(screen.getByRole("img", { name: "DOBLE" })).toBeTruthy();
  });

  it("prefiere la foto primaria", () => {
    render(
      <PosCatalogPhoto
        name="DOBLE"
        images={[
          foto({ id: "img_2", url: "https://cdn.test/otra.png", isPrimary: false, sortOrder: 0 }),
          foto({ id: "img_3", url: "https://cdn.test/primaria.png", isPrimary: true, sortOrder: 1 }),
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "DOBLE" }).getAttribute("src")).toBe(
      "https://cdn.test/primaria.png",
    );
  });

  it("sin fotos dibuja el respaldo, no una imagen rota", () => {
    render(<PosCatalogPhoto name="AGUA" images={[]} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("pos-catalog-photo-fallback")).toBeTruthy();
  });

  it("si la foto no carga, cae al respaldo", () => {
    render(<PosCatalogPhoto name="DOBLE" images={[foto()]} />);

    fireEvent.error(screen.getByRole("img", { name: "DOBLE" }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("pos-catalog-photo-fallback")).toBeTruthy();
  });
});
