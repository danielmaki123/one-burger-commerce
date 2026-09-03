// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

import { countAvailableSelectionGroups } from "./page";
import ProductDetailPage from "./page";

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
});
