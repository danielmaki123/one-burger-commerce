import { describe, expect, it } from "vitest";

import { summarizeMenuHub } from "./menu-hub-helpers";

const NOW = Date.parse("2026-09-16T18:00:00.000Z");

function block(
  id: string,
  overrides: Partial<{
    isActive: boolean;
    sortOrder: number;
    startsAt: Date | null;
    endsAt: Date | null;
  }> = {},
) {
  return {
    id,
    type: "promo" as const,
    title: `Bloque ${id}`,
    description: null,
    imageUrl: null,
    ctaLabel: null,
    ctaType: "none" as const,
    ctaTarget: null,
    isActive: true,
    sortOrder: 0,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  };
}

function input(overrides: Partial<Parameters<typeof summarizeMenuHub>[0]> = {}) {
  return {
    categories: [{ isActive: true }, { isActive: true }, { isActive: false }],
    subcategories: [{}, {}],
    activeProducts: [
      { availability: { isAvailable: true } },
      { availability: { isAvailable: true } },
      { availability: { isAvailable: false } },
    ],
    modifierGroups: [{}, {}, {}, {}],
    marketingBlocks: [],
    promotions: [{ status: "active" }, { status: "expired" }, { status: "active" }],
    ...overrides,
  };
}

describe("summarizeMenuHub", () => {
  it("cuenta la estructura con las categorías activas y los productos disponibles", () => {
    const summary = summarizeMenuHub(input(), NOW);

    expect(summary.categories).toBe(2);
    expect(summary.subcategories).toBe(2);
    expect(summary.products).toBe(3);
    expect(summary.unavailable).toBe(1);
    expect(summary.modifierGroups).toBe(4);
  });

  it("calcula el porcentaje de stock y no divide por cero sin catálogo", () => {
    // 2 de 3 disponibles.
    expect(summarizeMenuHub(input(), NOW).stockPercent).toBe(67);
    expect(
      summarizeMenuHub(input({ activeProducts: [] }), NOW).stockPercent,
    ).toBe(0);
    expect(
      summarizeMenuHub(
        input({ activeProducts: [{ availability: { isAvailable: true } }] }),
        NOW,
      ).stockPercent,
    ).toBe(100);
  });

  it("cuenta solo las promos usables hoy", () => {
    expect(summarizeMenuHub(input(), NOW).activePromotions).toBe(2);
  });

  it("muestra hasta tres bloques visibles hoy, del más prioritario al menos", () => {
    const summary = summarizeMenuHub(
      input({
        marketingBlocks: [
          block("c", { sortOrder: 3 }),
          block("a", { sortOrder: 1 }),
          block("b", { sortOrder: 2 }),
          block("d", { sortOrder: 4 }),
          block("apagado", { isActive: false, sortOrder: 0 }),
          block("futuro", { sortOrder: 0, startsAt: new Date(NOW + 86_400_000) }),
          block("vencido", { sortOrder: 0, endsAt: new Date(NOW - 86_400_000) }),
        ],
      }),
      NOW,
    );

    expect(summary.visiblePromotions.map((item) => item.id)).toEqual(["a", "b", "c"]);
    // La vista previa recorta a tres, pero el contador dice cuántos hay visibles hoy.
    expect(summary.activeBlocks).toBe(4);
  });

  it("sin bloques activos no hay nada que previsualizar", () => {
    const summary = summarizeMenuHub(
      input({ marketingBlocks: [block("apagado", { isActive: false })] }),
      NOW,
    );

    expect(summary.visiblePromotions).toEqual([]);
  });
});
