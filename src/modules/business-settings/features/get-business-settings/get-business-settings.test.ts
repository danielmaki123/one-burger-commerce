import { describe, expect, it } from "vitest";

import { InMemoryBusinessSettingsRepository } from "@/modules/business-settings/adapters/in-memory-business-settings-repository";
import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import { getBusinessSettings } from "./get-business-settings";

describe("getBusinessSettings", () => {
  it("devuelve la fila guardada cuando existe", async () => {
    const repository = new InMemoryBusinessSettingsRepository();
    repository.record = createDefaultBusinessSettingsRecord({ name: "Burger Nick" });

    const settings = await getBusinessSettings({ repository });

    expect(settings.name).toBe("Burger Nick");
  });

  it("cae a los defaults cuando la fila todavía no existe", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    const settings = await getBusinessSettings({ repository });

    expect(settings).toMatchObject({
      id: "default",
      name: "One Burger",
      currencySymbol: "C$",
      tipRate: 10,
    });
    expect(settings.updatedAt).toBeInstanceOf(Date);
  });

  it("no expone los defaults compartidos a quien muta el resultado", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    const settings = await getBusinessSettings({ repository });
    settings.businessHours.mon.closed = true;

    const again = await getBusinessSettings({ repository });
    expect(again.businessHours.mon.closed).toBe(false);
  });
});
