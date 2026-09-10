import { mergeBusinessHours } from "@/modules/business-settings/domain/business-hours";
import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import {
  BUSINESS_SETTINGS_ID,
  type BusinessSettingsPatch,
  type BusinessSettingsRecord,
} from "@/modules/business-settings/domain/business-settings.types";
import type {
  BusinessSettingsRepository,
  UpdateBusinessSettingsMeta,
} from "@/modules/business-settings/ports/business-settings-repository";

/** Doble de test: mismo contrato que el adaptador de Prisma, sin base de datos. */
export class InMemoryBusinessSettingsRepository implements BusinessSettingsRepository {
  record: BusinessSettingsRecord | null = null;

  async get(): Promise<BusinessSettingsRecord | null> {
    if (!this.record) return null;

    return {
      ...this.record,
      businessHours: mergeBusinessHours(null, this.record.businessHours),
    };
  }

  async update(
    patch: BusinessSettingsPatch,
    meta: UpdateBusinessSettingsMeta = {},
  ): Promise<BusinessSettingsRecord> {
    const base = this.record ?? createDefaultBusinessSettingsRecord();

    const next: BusinessSettingsRecord = {
      ...base,
      ...stripUndefined(patch),
      id: BUSINESS_SETTINGS_ID,
      businessHours: mergeBusinessHours(base.businessHours, patch.businessHours),
      updatedAt: new Date(),
      updatedByUserId: meta.updatedByUserId ?? base.updatedByUserId ?? null,
    };

    this.record = next;
    return next;
  }
}

function stripUndefined(patch: BusinessSettingsPatch): BusinessSettingsPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as BusinessSettingsPatch;
}
