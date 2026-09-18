import type { BusinessSettings, Prisma } from "@prisma/client";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { readBusinessHours } from "@/modules/business-settings/domain/business-hours";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import {
  BUSINESS_SETTINGS_ID,
  type BusinessSettingsPatch,
  type BusinessSettingsRecord,
  type FontChoice,
} from "@/modules/business-settings/domain/business-settings.types";
import type {
  BusinessSettingsRepository,
  UpdateBusinessSettingsMeta,
} from "@/modules/business-settings/ports/business-settings-repository";

function toJson(hours: BusinessSettingsPatch["businessHours"]): Prisma.InputJsonValue {
  return hours as unknown as Prisma.InputJsonValue;
}

function toPersistence(patch: BusinessSettingsPatch) {
  const { businessHours, ...rest } = patch;

  return {
    ...rest,
    ...(businessHours !== undefined ? { businessHours: toJson(businessHours) } : {}),
  };
}

function mapRow(row: BusinessSettings): BusinessSettingsRecord {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    taxId: row.taxId,
    taxAddress: row.taxAddress,
    taxPhone: row.taxPhone,
    tagline: row.tagline,
    description: row.description,
    logoUrl: row.logoUrl,
    logoMarkUrl: row.logoMarkUrl,
    faviconUrl: row.faviconUrl,
    ogImageUrl: row.ogImageUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    foregroundColor: row.foregroundColor,
    surfaceColor: row.surfaceColor,
    headingFont: row.headingFont as FontChoice,
    bodyFont: row.bodyFont as FontChoice,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    instagram: row.instagram,
    facebook: row.facebook,
    tiktok: row.tiktok,
    addressLine: row.addressLine,
    city: row.city,
    addressReference: row.addressReference,
    mapsUrl: row.mapsUrl,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    // El JSON guardado nunca se confía: se normaliza día por día.
    businessHours: readBusinessHours(row.businessHours),
    currencyCode: row.currencyCode,
    currencySymbol: row.currencySymbol,
    locale: row.locale,
    usdExchangeRate: row.usdExchangeRate,
    pickupLeadMinutes: row.pickupLeadMinutes,
    pickupMaxMinutes: row.pickupMaxMinutes,
    paymentInstructions: row.paymentInstructions,
    tipEnabled: row.tipEnabled,
    tipRate: row.tipRate,
    withdrawalLimit: row.withdrawalLimit,
    isAcceptingOrders: row.isAcceptingOrders,
    closedMessage: row.closedMessage,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

export class PrismaBusinessSettingsRepository implements BusinessSettingsRepository {
  async get(): Promise<BusinessSettingsRecord | null> {
    const row = await getPrismaClient().businessSettings.findUnique({
      where: { id: BUSINESS_SETTINGS_ID },
    });

    return row ? mapRow(row) : null;
  }

  async update(
    patch: BusinessSettingsPatch,
    meta: UpdateBusinessSettingsMeta = {},
  ): Promise<BusinessSettingsRecord> {
    const data = toPersistence(patch);
    const updatedByUserId = meta.updatedByUserId ?? null;

    const row = await getPrismaClient().businessSettings.upsert({
      where: { id: BUSINESS_SETTINGS_ID },
      create: {
        ...toPersistence(DEFAULT_BUSINESS_SETTINGS),
        ...data,
        // Explícito para que el tipo sea cerrado: la columna es NOT NULL.
        businessHours: data.businessHours ?? toJson(DEFAULT_BUSINESS_SETTINGS.businessHours),
        id: BUSINESS_SETTINGS_ID,
        updatedByUserId,
      },
      update: {
        ...data,
        updatedByUserId,
      },
    });

    return mapRow(row);
  }
}
