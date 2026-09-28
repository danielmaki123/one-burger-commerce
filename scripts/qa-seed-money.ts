/**
 * Siembra la configuración de dinero en una base **local** para la verificación visual de Finanzas.
 *
 * No es `prisma/seed.ts` ni una migración: las migraciones ya siembran esto en producción y en una base
 * nueva; este script existe porque el arnés de los tests de PostgreSQL **vacía** la base de test en cada
 * corrida (`resetDatabase`), así que después de correr `test:postgres` hay que volver a dejarla en un estado
 * parecido al real para abrir la pantalla.
 *
 * **Nunca** se corre contra producción: escribe configuración y lo dice su nombre (`qa-`).
 */
import { getPrismaClient } from "../src/infrastructure/database/prisma";

async function main() {
  const prisma = getPrismaClient();

  await prisma.currency.createMany({
    data: [
      { id: "cur_nio", code: "NIO", name: "Córdoba nicaragüense", symbol: "C$", decimals: 2, isKnown: true, sortOrder: 0 },
      { id: "cur_usd", code: "USD", name: "Dólar estadounidense", symbol: "US$", decimals: 2, isKnown: true, sortOrder: 1 },
      { id: "cur_eur", code: "EUR", name: "Euro", symbol: "€", decimals: 2, isKnown: true, sortOrder: 2 },
    ],
    skipDuplicates: true,
  });

  await prisma.businessCurrencySettings.upsert({
    where: { id: "default" },
    create: { id: "default", baseCurrencyCode: "NIO", locale: "es-NI" },
    update: {},
  });

  await prisma.exchangeRate.createMany({
    data: [
      {
        id: "rate_usd",
        fromCurrencyCode: "USD",
        toCurrencyCode: "NIO",
        rate: 36.5,
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.bank.createMany({
    data: [
      { id: "bank_bac", name: "BAC Credomatic", code: "BAC", entityType: "acquirer" },
      { id: "bank_banpro", name: "Banpro", code: "BANPRO", entityType: "bank" },
      { id: "bank_zelle", name: "Zelle", code: null, entityType: "digital_provider" },
    ],
    skipDuplicates: true,
  });

  await prisma.paymentMethodConfig.createMany({
    data: [
      { id: "pmc_cash", name: "Efectivo", kind: "cash", isActive: true, sortOrder: 0 },
      {
        id: "pmc_card",
        name: "Tarjeta BAC",
        kind: "card",
        isActive: true,
        sortOrder: 1,
        entityId: "bank_bac",
      },
      {
        id: "pmc_transfer",
        name: "Transferencia",
        kind: "bank_transfer",
        isActive: true,
        sortOrder: 2,
        requiresReference: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    "QA local: 3 monedas, moneda base NIO, 1 tasa, 3 entidades y 3 medios de pago configurados.",
  );

  await prisma.$disconnect();
}

void main();
