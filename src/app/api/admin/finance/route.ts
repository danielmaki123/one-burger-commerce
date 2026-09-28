import { financeError, readFinanceForRoute, writeFinanceForRoute } from "./finance-composition";

export const dynamic = "force-dynamic";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-018`, `A-80`) — **la configuración financiera del negocio**.
 *
 * La puerta (`canManageFinanceConfig`, owner), el despacho de los comandos con nombre y el mapeo de errores
 * viven en `finance-composition.ts`: el handler sólo orquesta, como exige el techo de 50 líneas.
 */
export async function GET() {
  try {
    return await readFinanceForRoute();
  } catch (error) {
    return financeError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await writeFinanceForRoute(request);
  } catch (error) {
    return financeError(error);
  }
}
