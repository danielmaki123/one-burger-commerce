import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { listAdminModifierGroups } from "./list-admin-modifier-groups";

describe("listAdminModifierGroups", () => {
  it("returns empty array when no modifier groups exist", async () => {
    const repository = new InMemoryMenuRepository();
    const result = await listAdminModifierGroups({ repository });
    expect(result.data).toEqual([]);
  });

  it("returns all modifier groups ordered by sortOrder", async () => {
    const repository = new InMemoryMenuRepository();
    repository.modifierGroups.push(
      {
        id: "mg_2",
        name: "Milk",
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
        sortOrder: 0,
        options: [],
      },
      {
        id: "mg_1",
        name: "Size",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 0,
        options: [],
      },
    );

    const result = await listAdminModifierGroups({ repository });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe("mg_2");
    expect(result.data[1].id).toBe("mg_1");
  });
});
