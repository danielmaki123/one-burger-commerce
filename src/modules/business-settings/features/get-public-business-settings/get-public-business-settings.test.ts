import { describe, expect, it, vi } from "vitest";

import { InMemoryBusinessSettingsRepository } from "@/modules/business-settings/adapters/in-memory-business-settings-repository";
import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import type {
  BusinessSettingsPatch,
  BusinessSettingsRecord,
} from "@/modules/business-settings/domain/business-settings.types";
import type { BusinessSettingsRepository } from "@/modules/business-settings/ports/business-settings-repository";
import { loadBusinessSettings } from "./get-public-business-settings";

class FailingRepository implements BusinessSettingsRepository {
  async get(): Promise<BusinessSettingsRecord | null> {
    throw new Error("la base no responde");
  }

  async update(_patch: BusinessSettingsPatch): Promise<BusinessSettingsRecord> {
    throw new Error("la base no responde");
  }
}

describe("loadBusinessSettings", () => {
  it("devuelve la configuración guardada", async () => {
    const repository = new InMemoryBusinessSettingsRepository();
    repository.record = createDefaultBusinessSettingsRecord({ name: "Burger Nick" });

    const settings = await loadBusinessSettings({ repository });

    expect(settings.name).toBe("Burger Nick");
  });

  it("cae a los defaults si la base falla, sin tumbar el sitio público", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const settings = await loadBusinessSettings({ repository: new FailingRepository() });

    expect(settings).toMatchObject({ name: "One Burger", currencySymbol: "C$" });
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
