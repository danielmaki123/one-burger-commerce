/**
 * Verificación de la configuración de dinero sembrada por las migraciones y el seed.
 *
 * Es un script de QA local, no un test: se corre con `npx tsx scripts/qa-money-config.ts` contra una base
 * local para ver **qué** quedó configurado antes de abrir la pantalla de Finanzas. No toca producción.
 */
import { getPrismaClient } from "../src/infrastructure/database/prisma";

async function main() {
  const prisma = getPrismaClient();

  console.log("currencies:", JSON.stringify(await prisma.currency.findMany({ select: { code: true, isActive: true } })));
  console.log("base:", JSON.stringify(await prisma.businessCurrencySettings.findFirst()));
  console.log(
    "rates:",
    JSON.stringify(
      await prisma.exchangeRate.findMany({
        select: { fromCurrencyCode: true, toCurrencyCode: true, rate: true, effectiveTo: true },
      }),
    ),
  );
  console.log(
    "methods:",
    JSON.stringify(await prisma.paymentMethodConfig.findMany({ select: { name: true, kind: true } })),
  );
  console.log("banks:", JSON.stringify(await prisma.bank.findMany({ select: { name: true, entityType: true } })));

  await prisma.$disconnect();
}

void main();
