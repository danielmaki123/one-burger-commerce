// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({
    productId: "prod-sangria",
  }),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

vi.mock("@/shared/lib/cart", () => ({
  useCart: () => ({
    addItem: vi.fn(),
    items: [],
  }),
}));

import ProductDetailPage from "./page";
import { countAvailableSelectionGroups } from "../product-detail-page-helpers";

describe("countAvailableSelectionGroups", () => {
  it("returns 0 when modifier groups do not offer any real options", () => {
    expect(
      countAvailableSelectionGroups([
        {
          id: "empty-group",
          name: "Vacío",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          options: [],
        },
      ]),
    ).toBe(0);
  });

  it("counts only groups that have at least one selectable option", () => {
    expect(
      countAvailableSelectionGroups([
        {
          id: "empty-group",
          name: "Vacío",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          options: [],
        },
        {
          id: "filled-group",
          name: "Salsas",
          isRequired: false,
          minSelections: 0,
          maxSelections: 2,
          options: [
            {
              id: "salsa-1",
              name: "Picante",
              priceDelta: 0,
            },
          ],
        },
      ]),
    ).toBe(1);
  });
});

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          categories: [
            {
              id: "cat-1",
              name: "Cocteles",
              products: [
                {
                  id: "prod-sangria",
                  name: "Sangría",
                  description: "Sangría en copa.",
                  basePrice: 0,
                  packagingFeeAmount: null,
                  images: [],
                  modifierGroups: [
                    {
                      id: "group-1",
                      name: "Sangrias",
                      isRequired: true,
                      minSelections: 1,
                      maxSelections: 1,
                      options: [
                        { id: "opt-1", name: "Sangría Personal", priceDelta: 185 },
                        { id: "opt-2", name: "Sangría de 1/2 Litro", priceDelta: 425 },
                      ],
                    },
                    {
                      id: "group-2",
                      name: "Acompañamiento",
                      isRequired: false,
                      minSelections: 0,
                      maxSelections: 1,
                      options: [{ id: "opt-3", name: "Sin pan", priceDelta: 0 }],
                    },
                  ],
                },
              ],
              subcategories: [],
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renderiza el eyebrow por tipo, conserva el desde real y evita precio duplicado por opción", async () => {
    render(React.createElement(ProductDetailPage));

    expect(await screen.findByText("Cóctel de la casa")).toBeTruthy();
    expect(screen.queryByText("Detalle del plato")).toBeNull();

    expect(screen.getByText("Desde")).toBeTruthy();
    expect(screen.getAllByText("C$185.00").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("+C$425.00")).toBeTruthy();
    expect(screen.queryByText("Suma C$425.00")).toBeNull();

    expect(screen.getByText("C$0.00")).toBeTruthy();
    expect(screen.queryByText("Sin cargo adicional")).toBeNull();
  });

  it("usa un bloque de precio compacto sin la pastilla rígida lateral del diseño anterior", async () => {
    const { container } = render(React.createElement(ProductDetailPage));

    await screen.findByText("Cóctel de la casa");

    expect(container.innerHTML).toContain("inline-flex flex-col items-start gap-1");
    expect(container.innerHTML).toContain("text-[1.25rem] font-semibold leading-none text-foreground");
    expect(container.innerHTML).not.toContain("rounded-[24px] border border-brand/30 bg-brand/10 px-4 py-3 text-right");
  });

  it("pone la cantidad antes de las opciones, como el mock", async () => {
    const { container } = render(React.createElement(ProductDetailPage));

    await screen.findByText("Cóctel de la casa");

    const html = container.innerHTML;
    const quantityIndex = html.indexOf("Cantidad");
    const optionsIndex = html.indexOf("Sangrias");

    // El mock ordena: título, descripción, cantidad, opciones, notas, CTA.
    expect(quantityIndex).toBeGreaterThan(-1);
    expect(optionsIndex).toBeGreaterThan(-1);
    expect(quantityIndex).toBeLessThan(optionsIndex);
  });

  it("el CTA fijo lleva el importe y la cantidad lo multiplica", async () => {
    const user = userEvent.setup();
    render(React.createElement(ProductDetailPage));

    await screen.findByText("Cóctel de la casa");

    const submit = screen.getByRole("button", { name: /Agregar al carrito/ }) as HTMLButtonElement;
    // El grupo obligatorio arranca con su primera opción elegida (igual que el
    // mock), así que el CTA está listo y muestra el importe de esa opción.
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toContain("C$185.00");

    // Elegir la otra opción mueve el importe del CTA fijo, sin recargar nada.
    await user.click(screen.getByRole("radio", { name: /Sangría de 1\/2 Litro/ }));
    expect(submit.textContent).toContain("C$425.00");

    // Y la cantidad lo multiplica.
    await user.click(screen.getByRole("button", { name: "Aumentar cantidad" }));
    expect(submit.textContent).toContain("C$850.00");
  });

  it("las notas, la cantidad y las opciones se pueden usar con teclado y con lector de pantalla", async () => {
    const { container } = render(React.createElement(ProductDetailPage));

    await screen.findByText("Cóctel de la casa");

    // El placeholder no es una etiqueta: el campo necesita la suya.
    expect(screen.getByLabelText("Notas especiales")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reducir cantidad" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aumentar cantidad" })).toBeTruthy();

    // El input real está oculto para el ojo: el anillo de foco tiene que verse en
    // la tarjeta, o el teclado navega a ciegas (defecto medido en el mock).
    const option = screen.getByRole("radio", { name: /Sangría Personal/ });
    const card = option.closest("label") as HTMLElement;
    expect(card.innerHTML).toContain("peer-focus-visible:ring-2");
    expect(container.innerHTML).toContain("peer-focus-visible:ring-2");
  });
});
