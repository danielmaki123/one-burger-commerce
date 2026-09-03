import { describe, expect, it } from "vitest";

import { applyModifierSelection, validateModifierSelections } from "./modifier-validation";

const mockGroup = (overrides: Partial<{
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: { id: string; name: string; priceDelta: number }[];
}> = {}) => ({
  id: "g1",
  name: "Toppings",
  isRequired: false,
  minSelections: 0,
  maxSelections: 3,
  options: [
    { id: "o1", name: "Queso", priceDelta: 0 },
    { id: "o2", name: "Jamón", priceDelta: 10 },
    { id: "o3", name: "Champiñones", priceDelta: 15 },
  ],
  ...overrides,
});

describe("applyModifierSelection", () => {
  it("required + maxSelections = 1 => behaves like radio (single select)", () => {
    const group = mockGroup({ isRequired: true, maxSelections: 1, minSelections: 1 });
    let selected: Record<string, string[]> = { g1: [] };

    selected = applyModifierSelection(selected, group.id, "o1", group.maxSelections);
    expect(selected.g1).toEqual(["o1"]);

    selected = applyModifierSelection(selected, group.id, "o2", group.maxSelections);
    expect(selected.g1).toEqual(["o2"]);
  });

  it("required + maxSelections > 1 => allows multiple selections up to max", () => {
    const group = mockGroup({ isRequired: true, maxSelections: 2, minSelections: 1 });
    let selected: Record<string, string[]> = { g1: [] };

    selected = applyModifierSelection(selected, group.id, "o1", group.maxSelections);
    expect(selected.g1).toEqual(["o1"]);

    selected = applyModifierSelection(selected, group.id, "o2", group.maxSelections);
    expect(selected.g1).toEqual(["o1", "o2"]);

    // max reached — third selection blocked
    selected = applyModifierSelection(selected, group.id, "o3", group.maxSelections);
    expect(selected.g1).toEqual(["o1", "o2"]);
  });

  it("optional with limited max => blocks selections beyond max", () => {
    const group = mockGroup({ isRequired: false, maxSelections: 2, minSelections: 0 });
    let selected: Record<string, string[]> = { g1: [] };

    selected = applyModifierSelection(selected, group.id, "o1", group.maxSelections);
    selected = applyModifierSelection(selected, group.id, "o2", group.maxSelections);
    expect(selected.g1).toEqual(["o1", "o2"]);

    selected = applyModifierSelection(selected, group.id, "o3", group.maxSelections);
    expect(selected.g1).toEqual(["o1", "o2"]);
  });

  it("toggling off works for multi-select", () => {
    const group = mockGroup({ maxSelections: 3 });
    let selected: Record<string, string[]> = { g1: ["o1", "o2"] };

    selected = applyModifierSelection(selected, group.id, "o1", group.maxSelections);
    expect(selected.g1).toEqual(["o2"]);
  });
});

describe("validateModifierSelections", () => {
  it("returns error when required group has zero selections", () => {
    const group = mockGroup({ isRequired: true, minSelections: 1 });
    const errors = validateModifierSelections([group], { g1: [] });
    expect(errors.g1).toContain("Selecciona al menos una opción");
  });

  it("returns error when selections < minSelections", () => {
    const group = mockGroup({ isRequired: true, minSelections: 2, maxSelections: 3 });
    const errors = validateModifierSelections([group], { g1: ["o1"] });
    expect(errors.g1).toContain("Mínimo 2 selecciones");
  });

  it("returns error when selections > maxSelections", () => {
    const group = mockGroup({ maxSelections: 1 });
    const errors = validateModifierSelections([group], { g1: ["o1", "o2"] });
    expect(errors.g1).toContain("Máximo 1 selección");
  });

  it("CTA blocked state: returns errors object with keys when invalid", () => {
    const group = mockGroup({ isRequired: true, minSelections: 1, maxSelections: 1 });
    const errors = validateModifierSelections([group], { g1: [] });
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });

  it("CTA allowed state: returns empty errors when valid", () => {
    const group = mockGroup({ isRequired: true, minSelections: 1, maxSelections: 2 });
    const errors = validateModifierSelections([group], { g1: ["o1", "o2"] });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
