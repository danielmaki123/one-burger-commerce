import { z } from "zod";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { canManageFinanceConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaBankRepository } from "@/modules/banks/adapters/prisma-bank-repository";
import { getBankCatalog } from "@/modules/banks/features/get-bank-catalog/get-bank-catalog";
import { PrismaBusinessCurrencySettingsRepository } from "@/modules/money/adapters/prisma-business-currency-settings-repository";
import { PrismaCurrencyRepository } from "@/modules/money/adapters/prisma-currency-repository";
import { PrismaExchangeRateRepository } from "@/modules/money/adapters/prisma-exchange-rate-repository";
import { KNOWN_CURRENCIES, KNOWN_LOCALES } from "@/modules/money/domain/currency-catalog";
import { MoneyError } from "@/modules/money/domain/money-errors";
import { changeBaseCurrency } from "@/modules/money/features/change-base-currency/change-base-currency";
import { getMoneySettings } from "@/modules/money/features/get-money-settings/get-money-settings";
import { registerExchangeRate } from "@/modules/money/features/register-exchange-rate/register-exchange-rate";
import { saveCurrency } from "@/modules/money/features/save-currency/save-currency";
import { updateMoneyLocale } from "@/modules/money/features/update-money-locale/update-money-locale";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-80`, `D-016`, `D-018`) — **la superficie de Finanzas**
 * (`/admin/finance`), la pantalla de configuración financiera del dueño.
 *
 * Reglas de la ruta, tal como las exige `AGENTS.md` § *Límites de código* y `security-change`:
 *
 * 1. **La autorización se aplica acá**, no en el componente. La puerta es `canManageFinanceConfig`
 *    (**owner**): cambiar la moneda base, una tasa o qué medios se aceptan cambia el número que el sistema
 *    espera. Ocultar la entrada de navegación no autoriza nada.
 * 2. **Sin Prisma directo en el `route.ts`**: la lectura y las escrituras viven en este archivo, y los
 *    casos de uso de `money`/`banks` son los que tienen las reglas.
 * 3. **El payload se valida con zod** antes de tocar el dominio.
 *
 * La ruta es de **lectura y de escritura de configuración**: no hay ninguna operación sobre hechos
 * históricos. Cambiar la moneda base o registrar una tasa **no** recalcula cobros, cierres ni facturas
 * (`D-018`), y la respuesta lo dice para que la pantalla lo pueda informar antes de confirmar.
 */

const currencySchema = z.object({
  code: z.string().trim().min(2, "Poné el código de la moneda.").max(12, "Ese código es muy largo."),
  name: z.string().trim().max(60).nullable().optional(),
  symbol: z.string().trim().max(8).nullable().optional(),
  decimals: z.number().int().min(0).max(4).nullable().optional(),
  isActive: z.boolean().optional(),
  /** `create` rechaza el código duplicado; `update` edita una moneda que ya existe. */
  mode: z.enum(["create", "update"]).optional(),
});

const rateSchema = z.object({
  fromCurrencyCode: z.string().trim().min(2).max(12),
  rate: z.number().positive("La tasa tiene que ser mayor que cero."),
});

const baseCurrencySchema = z.object({
  code: z.string().trim().min(2).max(12),
  locale: z.string().trim().min(2).max(12).optional(),
});

/** `A-87` — el formato regional, solo. Misma forma que valida el dominio (`es-NI`). */
const localeSchema = z.object({
  locale: z.string().trim().min(2).max(12),
});

const paymentMethodSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Poné el nombre del medio.").max(60),
  kind: z.enum(["cash", "card", "bank_transfer", "wallet", "other"], {
    message: "Elegí el tipo del medio.",
  }),
  entityId: z.string().trim().min(1).nullable().optional(),
  currencyCodes: z.array(z.string().trim().min(1).max(12)).max(20).optional(),
  requiresReference: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const entitySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Poné el nombre de la entidad.").max(60),
  code: z.string().trim().max(20).nullable().optional(),
  entityType: z.enum(["bank", "acquirer", "digital_provider", "other"], {
    message: "Elegí el tipo de entidad.",
  }),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

async function requireFinanceSession() {
  const session = await requireAdminSession();

  if (!canManageFinanceConfig(session.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  return session;
}

/** Lo que la pantalla necesita leer: configuración vigente, catálogos y las entidades de cobro. */
export async function readFinanceConfig() {
  await requireFinanceSession();

  const exchangeRateRepository = new PrismaExchangeRateRepository();

  const [settings, bankCatalog] = await Promise.all([
    getMoneySettings({
      currencyRepository: new PrismaCurrencyRepository(),
      exchangeRateRepository,
      settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
    }),
    getBankCatalog({ repository: new PrismaBankRepository() }),
  ]);

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **la tasa vigente que la pantalla dibuja, como filas**.
   *
   * `MoneySettingsView.activeRates` es el **mapa** `moneda → tasa` que consume la conversión
   * (`{ USD: 36.5 }`), no una lista: la pantalla necesita, además del número, contra qué moneda base se
   * registró y desde cuándo. Confundir las dos formas **rompía la vista de Monedas y tasas con un
   * `activeRates.find is not a function`** apenas el mapa tuviera una entrada —es decir, siempre, salvo en
   * la primera instalación, donde el mapa vacío lo tapaba—. Lo encontró la QA en navegador real, no los
   * tests: la ruta se probaba con la configuración mockeada y el tipo del cliente era una afirmación.
   *
   * Por eso la API devuelve las **filas** (`rateHistory`) para dibujar, y deja el mapa donde corresponde:
   * en el dominio que convierte.
   */
  const rateHistory = await exchangeRateRepository.listActiveRatesTo(settings.baseCurrencyCode);

  const prisma = getPrismaClient();
  const paymentMethods = await prisma.paymentMethodConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { locations: { select: { locationId: true, isActive: true } } },
  });

  return {
    settings: { ...settings, rateHistory },
    /** El catálogo conocido es conveniencia del formulario, no una restricción (`D-019`). */
    knownCurrencies: KNOWN_CURRENCIES,
    knownLocales: KNOWN_LOCALES,
    entities: bankCatalog.banks,
    paymentMethods: paymentMethods.map((method) => ({
      id: method.id,
      name: method.name,
      kind: method.kind,
      entityId: method.entityId,
      currencyCodes: method.currencyCodes,
      requiresReference: method.requiresReference,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
      locationIds: method.locations.filter((row) => row.isActive).map((row) => row.locationId),
    })),
  };
}

export type FinanceConfig = Awaited<ReturnType<typeof readFinanceConfig>>;

/** Alta o edición de una moneda. Una moneda **no se borra**: se apaga (`isActive: false`). */
export async function saveCurrencyForRoute(body: unknown) {
  await requireFinanceSession();
  const parsed = currencySchema.safeParse(body);

  if (!parsed.success) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Revisá la moneda.", fieldErrors(parsed.error));
  }

  return saveCurrency(
    {
      code: parsed.data.code,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.symbol ? { symbol: parsed.data.symbol } : {}),
      ...(parsed.data.decimals === null || parsed.data.decimals === undefined
        ? {}
        : { decimals: parsed.data.decimals }),
      ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
      /**
       * La pantalla **edita** una moneda del catálogo (el alta es del formulario «Agregar moneda», que manda
       * el modo explícito). Se acepta `mode` en el cuerpo para no tener dos rutas para lo mismo; el default
       * del caso de uso —`create`, que rechaza el código duplicado— queda para el alta.
       */
      mode: parsed.data.mode,
    },
    {
      repository: new PrismaCurrencyRepository(),
      settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
    },
  );
}

/** Registra una tasa: **un hecho nuevo** que cierra el período anterior, con su asiento de auditoría. */
export async function registerRateForRoute(body: unknown) {
  const session = await requireFinanceSession();
  const parsed = rateSchema.safeParse(body);

  if (!parsed.success) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Revisá la tasa.", fieldErrors(parsed.error));
  }

  return registerExchangeRate(
    { fromCurrencyCode: parsed.data.fromCurrencyCode, rate: parsed.data.rate },
    {
      repository: new PrismaExchangeRateRepository(),
      settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
      actorUserId: session.user.id,
    },
  );
}

/**
 * Cambia la moneda base: **operación explícita y auditada** que abre un período nuevo y **no** recalcula
 * ningún hecho (`D-018`). La respuesta informa qué queda intacto, para que la pantalla lo diga antes de
 * confirmar.
 */
export async function changeBaseCurrencyForRoute(body: unknown) {
  const session = await requireFinanceSession();
  const parsed = baseCurrencySchema.safeParse(body);

  if (!parsed.success) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Revisá la moneda base.", fieldErrors(parsed.error));
  }

  const result = await changeBaseCurrency(
    { code: parsed.data.code, ...(parsed.data.locale ? { locale: parsed.data.locale } : {}) },
    {
      currencyRepository: new PrismaCurrencyRepository(),
      settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
      actorUserId: session.user.id,
    },
  );

  return {
    ...result,
    /**
     * El alcance de la operación, explícito en la respuesta: la pantalla lo muestra tal cual. No es
     * decorativo —es la garantía de `D-018`— y por eso viaja en el cuerpo y no en un texto fijo del cliente.
     */
    scope: {
      recalculates: false as const,
      message:
        "Los hechos históricos conservan su moneda, su tasa y su equivalente. Nada ya registrado se recalcula.",
    },
  };
}

/**
 * `A-87` — **cambia sólo el formato regional**.
 *
 * Es un comando propio y no `change-base-currency` con la misma base: el formato es presentación, no cierra
 * períodos de tasa ni deja asiento de cambio de base. El modal «Cambiar formato» de Finanzas llamaba al
 * cambio de base con la base vigente, que el dominio rechaza con `409`, así que no guardaba nada.
 */
export async function updateLocaleForRoute(body: unknown) {
  const session = await requireFinanceSession();
  const parsed = localeSchema.safeParse(body);

  if (!parsed.success) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Revisá el formato regional.", fieldErrors(parsed.error));
  }

  return updateMoneyLocale(
    { locale: parsed.data.locale },
    {
      settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
      actorUserId: session.user.id,
    },
  );
}

/** Alta o edición de un medio de pago, con su tipo canónico y su disponibilidad por local. */
export async function savePaymentMethodForRoute(body: unknown) {
  await requireFinanceSession();
  const parsed = paymentMethodSchema.safeParse(body);

  if (!parsed.success) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Revisá el medio de pago.", fieldErrors(parsed.error));
  }

  const prisma = getPrismaClient();
  const data = parsed.data;
  const saved = await prisma.paymentMethodConfig.upsert({
    where: data.id ? { id: data.id } : { name: data.name },
    create: {
      name: data.name,
      kind: data.kind,
      entityId: data.entityId ?? null,
      currencyCodes: data.currencyCodes ?? [],
      requiresReference: data.requiresReference ?? false,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
    update: {
      name: data.name,
      kind: data.kind,
      entityId: data.entityId ?? null,
      currencyCodes: data.currencyCodes ?? [],
      requiresReference: data.requiresReference ?? false,
      ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
    },
  });

  return { id: saved.id, name: saved.name, kind: saved.kind, isActive: saved.isActive };
}

/** Alta o edición de una entidad de cobro: **es** el catálogo `banks`, con su tipo (no hay uno paralelo). */
export async function saveEntityForRoute(body: unknown) {
  await requireFinanceSession();
  const parsed = entitySchema.safeParse(body);

  if (!parsed.success) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Revisá la entidad.", fieldErrors(parsed.error));
  }

  const prisma = getPrismaClient();
  const data = parsed.data;
  const saved = await prisma.bank.upsert({
    where: data.id ? { id: data.id } : { name: data.name },
    create: {
      name: data.name,
      code: data.code ?? null,
      entityType: data.entityType,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
    update: {
      name: data.name,
      code: data.code ?? null,
      entityType: data.entityType,
      ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
    },
  });

  return { id: saved.id, name: saved.name, entityType: saved.entityType, isActive: saved.isActive };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
}
