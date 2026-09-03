import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import { createModifierGroup } from "./create-modifier-group";

describe("createModifierGroup", () => {
  it("creates a modifier group with options", async () => {
    const repository = new InMemoryMenuRepository();

    const result = await createModifierGroup(
      {
        name: "Size",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 0,
        options: [
          { name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 },
          { name: "Large", priceDelta: 15, isActive: true, sortOrder: 1 },
        ],
      },
      { repository },
    );

    expect(result.data.name).toBe("Size");
    expect(result.data.isRequired).toBe(true);
    expect(result.data.minSelections).toBe(1);
    expect(result.data.maxSelections).toBe(1);
    expect(result.data.options).toHaveLength(2);
    expect(result.data.options[0].name).toBe("Small");
    expect(result.data.options[1].priceDelta).toBe(15);
  });

  it("rejects empty name", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      createModifierGroup(
        {
          name: "",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          sortOrder: 0,
          options: [{ name: "Option", priceDelta: 0, isActive: true, sortOrder: 0 }],
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("rejects minSelections > maxSelections", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      createModifierGroup(
        {
          name: "Size",
          isRequired: true,
          minSelections: 2,
          maxSelections: 1,
          sortOrder: 0,
          options: [{ name: "Option", priceDelta: 0, isActive: true, sortOrder: 0 }],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects negative maxSelections", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      createModifierGroup(
        {
          name: "Size",
          isRequired: false,
          minSelections: 0,
          maxSelections: -1,
          sortOrder: 0,
          options: [{ name: "Option", priceDelta: 0, isActive: true, sortOrder: 0 }],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects empty options", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      createModifierGroup(
        {
          name: "Size",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          sortOrder: 0,
          options: [],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects option with empty name", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      createModifierGroup(
        {
          name: "Size",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          sortOrder: 0,
          options: [{ name: "", priceDelta: 0, isActive: true, sortOrder: 0 }],
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("rejects all inactive options", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      createModifierGroup(
        {
          name: "Size",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          sortOrder: 0,
          options: [
            { name: "Small", priceDelta: 0, isActive: false, sortOrder: 0 },
            { name: "Large", priceDelta: 15, isActive: false, sortOrder: 1 },
          ],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});
