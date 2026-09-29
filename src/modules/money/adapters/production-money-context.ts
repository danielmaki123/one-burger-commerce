import { PrismaBusinessCurrencySettingsRepository } from "@/modules/money/adapters/prisma-business-currency-settings-repository";
import { PrismaCurrencyRepository } from "@/modules/money/adapters/prisma-currency-repository";
import { PrismaExchangeRateRepository } from "@/modules/money/adapters/prisma-exchange-rate-repository";
import type { AcceptedCurrencies } from "@/modules/money/features/list-accepted-currencies/list-accepted-currencies";
import { readAcceptedCurrencies } from "@/modules/money/features/list-accepted-currencies/list-accepted-currencies";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — **la lectura monetaria de producción**.
 *
 * Es la única puerta por la que un consumidor de producción (el POS, el cobro de un pedido, una devolución,
 * un cierre) obtiene la moneda base vigente y sus tasas. Existe para que ninguno vuelva a leer
 * `BusinessSettings.currencyCode`/`usdExchangeRate`: mientras los dos caminos convivían, la misma operación
 * podía convertirse con dos tasas distintas según por dónde entrara (`A-83`).
 *
 * `money` es el dueño del dato (`getMoneySettings`); acá sólo se arma el grafo de dependencias, que es lo
 * que un adaptador puede hacer y un caso de uso no instancia Prisma.
 */
export async function readProductionMoney(): Promise<AcceptedCurrencies> {
  return readAcceptedCurrencies({
    currencyRepository: new PrismaCurrencyRepository(),
    exchangeRateRepository: new PrismaExchangeRateRepository(),
    settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
  });
}
