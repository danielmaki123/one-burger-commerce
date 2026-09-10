"use client";

import React, { createContext, useContext } from "react";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import type { BusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings.types";
import type { CurrencyFormat } from "@/shared/lib/format-currency";

/**
 * La configuración del negocio tal como la ven los componentes cliente.
 *
 * `updatedAt` viaja como ISO string porque cruza el límite RSC → cliente.
 */
export type BusinessSettingsValue = Omit<BusinessSettingsRecord, "updatedAt"> & {
  updatedAt: string;
};

/**
 * Fallback para componentes que se renderizan fuera del provider (tests
 * unitarios, páginas sueltas). Son los mismos defaults del dominio, así que
 * nunca introduce un valor nuevo.
 */
export const FALLBACK_BUSINESS_SETTINGS: BusinessSettingsValue = {
  ...DEFAULT_BUSINESS_SETTINGS,
  updatedAt: new Date(0).toISOString(),
  updatedByUserId: null,
};

const BusinessSettingsContext = createContext<BusinessSettingsValue | null>(null);

export function BusinessSettingsProvider({
  settings,
  children,
}: {
  settings: BusinessSettingsValue;
  children: React.ReactNode;
}) {
  return (
    <BusinessSettingsContext.Provider value={settings}>
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings(): BusinessSettingsValue {
  return useContext(BusinessSettingsContext) ?? FALLBACK_BUSINESS_SETTINGS;
}

/** Formato de moneda configurado, para pasarle a `formatCurrency`. */
export function useCurrencyFormat(): CurrencyFormat {
  const settings = useBusinessSettings();

  return { symbol: settings.currencySymbol, locale: settings.locale };
}
