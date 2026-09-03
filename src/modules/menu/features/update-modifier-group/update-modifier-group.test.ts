import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import { updateModifierGroup } from "./update-modifier-group";

describe("updateModifierGroup", () => {
  it("updates a modifier group name", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    const result = await updateModifierGroup(
      created.id,
      { name: "Updated Size" },
      { repository },
    );

    expect(result.data.name).toBe("Updated Size");
    expect(result.data.options).toHaveLength(1);
  });

  it("updates options within the same group", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [
        { name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 },
        { name: "Large", priceDelta: 15, isActive: true, sortOrder: 1 },
      ],
    });

    const result = await updateModifierGroup(
      created.id,
      {
        options: [
          { id: created.options[0].id, name: "Small Updated", priceDelta: 0, isActive: true, sortOrder: 0 },
          { id: created.options[1].id, name: "Large Updated", priceDelta: 20, isActive: true, sortOrder: 1 },
        ],
      },
      { repository },
    );

    expect(result.data.options).toHaveLength(2);
    expect(result.data.options[0].name).toBe("Small Updated");
    expect(result.data.options[1].priceDelta).toBe(20);
  });

  it("rejects cross-group option ID attack with 422", async () => {
    const repository = new InMemoryMenuRepository();
    const groupA = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });
    const groupB = await repository.createModifierGroup({
      name: "Toppings",
      isRequired: false,
      minSelections: 0,
      maxSelections: 3,
      sortOrder: 1,
      options: [{ name: "Cheese", priceDelta: 5, isActive: true, sortOrder: 0 }],
    });

    await expect(
      updateModifierGroup(
        groupA.id,
        {
          options: [
            { id: groupB.options[0].id, name: "Injected", priceDelta: 999, isActive: true, sortOrder: 0 },
          ],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("foreign option ID does not mutate or delete target group options", async () => {
    const repository = new InMemoryMenuRepository();
    const groupA = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [
        { name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 },
        { name: "Large", priceDelta: 15, isActive: true, sortOrder: 1 },
      ],
    });
    const groupB = await repository.createModifierGroup({
      name: "Toppings",
      isRequired: false,
      minSelections: 0,
      maxSelections: 3,
      sortOrder: 1,
      options: [{ name: "Cheese", priceDelta: 5, isActive: true, sortOrder: 0 }],
    });

    const originalOptionIds = groupA.options.map((o) => o.id);
    const originalOptionNames = groupA.options.map((o) => o.name);

    await expect(
      updateModifierGroup(
        groupA.id,
        {
          options: [
            { id: groupA.options[0].id, name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 },
            { id: groupB.options[0].id, name: "Injected", priceDelta: 999, isActive: true, sortOrder: 1 },
          ],
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);

    const afterA = await repository.getModifierGroupById(groupA.id);
    expect(afterA).not.toBeNull();
    expect(afterA!.options).toHaveLength(2);
    expect(afterA!.options.map((o) => o.id)).toEqual(originalOptionIds);
    expect(afterA!.options.map((o) => o.name)).toEqual(originalOptionNames);
  });

  it("rejects minSelections > maxSelections", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    await expect(
      updateModifierGroup(
        created.id,
        { minSelections: 3, maxSelections: 1 },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects negative maxSelections", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    await expect(
      updateModifierGroup(
        created.id,
        { maxSelections: -1 },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects empty options array", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    await expect(
      updateModifierGroup(
        created.id,
        { options: [] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects option with empty name", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    await expect(
      updateModifierGroup(
        created.id,
        {
          options: [{ name: "", priceDelta: 0, isActive: true, sortOrder: 0 }],
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("rejects all inactive options", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    await expect(
      updateModifierGroup(
        created.id,
        {
          options: [
            { name: "A", priceDelta: 0, isActive: false, sortOrder: 0 },
            { name: "B", priceDelta: 0, isActive: false, sortOrder: 1 },
          ],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("returns 404 when modifier group does not exist", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      updateModifierGroup(
        "nonexistent",
        { name: "Whatever" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
