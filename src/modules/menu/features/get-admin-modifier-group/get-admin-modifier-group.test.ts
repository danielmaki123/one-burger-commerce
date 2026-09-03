import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { getAdminModifierGroup } from "./get-admin-modifier-group";

describe("getAdminModifierGroup", () => {
  it("returns a modifier group by id", async () => {
    const repository = new InMemoryMenuRepository();
    const created = await repository.createModifierGroup({
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [{ name: "Small", priceDelta: 0, isActive: true, sortOrder: 0 }],
    });

    const result = await getAdminModifierGroup(created.id, { repository });
    expect(result.data.id).toBe(created.id);
    expect(result.data.name).toBe("Size");
    expect(result.data.options).toHaveLength(1);
  });

  it("throws 404 for nonexistent group", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      getAdminModifierGroup("mg_missing", { repository }),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
