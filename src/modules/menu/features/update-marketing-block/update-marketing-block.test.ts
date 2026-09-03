import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { updateMarketingBlock } from "./update-marketing-block";

describe("updateMarketingBlock", () => {
  it("returns 404 when the marketing block does not exist", async () => {
    const repository = new InMemoryMenuRepository();

    await expect(
      updateMarketingBlock(
        "missing",
        {
          title: "Nuevo título",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Marketing block not found",
    });
  });
});
