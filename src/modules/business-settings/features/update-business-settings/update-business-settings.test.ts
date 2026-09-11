import { describe, expect, it } from "vitest";

import { InMemoryBusinessSettingsRepository } from "@/modules/business-settings/adapters/in-memory-business-settings-repository";
import { DEFAULT_BUSINESS_HOURS } from "@/modules/business-settings/domain/business-settings-defaults";
import { BusinessSettingsError } from "@/modules/business-settings/domain/business-settings-errors";
import { updateBusinessSettings } from "./update-business-settings";

describe("updateBusinessSettings", () => {
  it("fusiona el parche sobre los defaults y audita quién lo cambió", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    const settings = await updateBusinessSettings(
      { name: "Burger Nick", tipRate: 0, tipEnabled: false },
      { repository, updatedByUserId: "admin_1" },
    );

    expect(settings).toMatchObject({
      id: "default",
      name: "Burger Nick",
      tipRate: 0,
      tipEnabled: false,
      currencySymbol: "C$",
      updatedByUserId: "admin_1",
    });
    expect(repository.record).toEqual(settings);
  });

  it("conserva lo guardado que el parche no menciona", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    await updateBusinessSettings({ name: "Burger Nick" }, { repository });
    const settings = await updateBusinessSettings({ city: "Managua" }, { repository });

    expect(settings).toMatchObject({ name: "Burger Nick", city: "Managua" });
  });

  it("rechaza un payload inválido sin tocar el repositorio", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    await expect(
      updateBusinessSettings({ primaryColor: "azul" }, { repository }),
    ).rejects.toBeInstanceOf(BusinessSettingsError);
    expect(repository.record).toBeNull();
  });

  it("reporta en qué campo está el error", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    await expect(
      updateBusinessSettings({ pickupLeadMinutes: 999 }, { repository }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      fields: { pickupLeadMinutes: expect.any(String) },
    });
  });

  it("compara el máximo contra el mínimo guardado cuando solo llega el máximo (T5)", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    await updateBusinessSettings({ pickupLeadMinutes: 30 }, { repository });

    await expect(
      updateBusinessSettings({ pickupMaxMinutes: 20 }, { repository }),
    ).rejects.toMatchObject({
      status: 422,
      fields: { pickupMaxMinutes: expect.any(String) },
    });
    // No se guardó nada a medias.
    expect(repository.record?.pickupMaxMinutes).toBeNull();
  });

  it("acepta el rango cuando el máximo alcanza al mínimo y guarda null para sacarlo (T5)", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    const withRange = await updateBusinessSettings(
      { pickupLeadMinutes: 20, pickupMaxMinutes: 40 },
      { repository },
    );
    expect(withRange.pickupMaxMinutes).toBe(40);

    const withoutRange = await updateBusinessSettings({ pickupMaxMinutes: null }, { repository });
    expect(withoutRange.pickupMaxMinutes).toBeNull();
  });

  it("fusiona los horarios día por día en vez de reemplazar la semana entera", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    const settings = await updateBusinessSettings(
      { businessHours: { sun: { closed: true, open: "12:00", close: "22:00" } } },
      { repository },
    );

    expect(settings.businessHours.sun).toEqual({ closed: true, open: "12:00", close: "22:00" });
    expect(settings.businessHours.mon).toEqual(DEFAULT_BUSINESS_HOURS.mon);
  });

  it("limpia los campos opcionales cuando llega una cadena vacía", async () => {
    const repository = new InMemoryBusinessSettingsRepository();
    await updateBusinessSettings({ phone: "+50588770888", tagline: "Hamburguesas" }, { repository });

    const settings = await updateBusinessSettings({ phone: "", tagline: "   " }, { repository });

    expect(settings.phone).toBeNull();
    expect(settings.tagline).toBeNull();
  });

  it("no permite cambiar el id ni la fecha de actualización desde el payload", async () => {
    const repository = new InMemoryBusinessSettingsRepository();

    const settings = await updateBusinessSettings(
      { id: "otro", updatedAt: new Date(0), name: "Burger Nick" },
      { repository },
    );

    expect(settings.id).toBe("default");
    expect(settings.updatedAt.getTime()).toBeGreaterThan(0);
  });
});
