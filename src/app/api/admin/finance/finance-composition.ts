import { NextResponse } from "next/server";

import { canManageFinanceConfig } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { MoneyError } from "@/modules/money/domain/money-errors";

import {
  changeBaseCurrencyForRoute,
  readFinanceConfig,
  registerRateForRoute,
  saveCurrencyForRoute,
  saveEntityForRoute,
  savePaymentMethodForRoute,
  updateLocaleForRoute,
} from "./finance-actions";
import { FINANCE_NO_STORE, financeErrorResponse } from "./finance-errors";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-018`, `A-80`) — **la composición de `/api/admin/finance`**.
 *
 * La superficie de configuración financiera del dueño. Vive acá y no en el `route.ts` porque el handler tiene
 * un techo de **50 líneas** (`AGENTS.md` § *Límites de código*): el `route` orquesta y esta composición tiene
 * la puerta, el despacho de comandos y el mapeo de errores.
 *
 * **La puerta se aplica acá**, en el servidor, antes de leer o escribir nada: es `canManageFinanceConfig`
 * (**owner**) porque cambiar la moneda base, una tasa o qué medios se aceptan cambia el número que el sistema
 * espera. Esconder la entrada de navegación no autoriza nada, y por eso la verificación no vive en el
 * componente.
 *
 * `GET` lee lo que la pantalla necesita: la configuración vigente (moneda base, locale, catálogo y tasas), el
 * catálogo conocido como conveniencia del formulario, las entidades de cobro (el catálogo `banks` con su
 * tipo) y los medios de pago con su tipo canónico.
 *
 * `POST` es un **comando con nombre** en el cuerpo (`action`), no cinco rutas para la misma pantalla:
 *
 * | `action` | Qué hace |
 * |---|---|
 * | `save-currency` | Alta o edición de una moneda (una moneda **no se borra**: se apaga) |
 * | `register-rate` | Registra una tasa: hecho nuevo que **cierra** el período anterior y deja asiento |
 * | `change-base-currency` | Operación **explícita y auditada** que **no** recalcula ningún hecho (`D-018`) |
 * | `update-locale` | Cambia **sólo el formato regional** (presentación): no cierra tasas ni deja asiento (`A-87`) |
 * | `save-payment-method` | Alta o edición de un medio con su tipo canónico y sus monedas |
 * | `save-entity` | Alta o edición de una **entidad de cobro** en el catálogo `banks` que ya existe |
 */
export async function requireFinanceOwner(): Promise<void> {
  const session = await requireAdminSession();

  if (!canManageFinanceConfig(session.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

export async function readFinanceForRoute() {
  await requireFinanceOwner();

  return NextResponse.json({ data: await readFinanceConfig() }, { headers: FINANCE_NO_STORE });
}

/** El comando con nombre, despachado a su acción. La puerta ya se aplicó: esto no autoriza, ejecuta. */
export async function runFinanceCommand(body: { action?: string; payload?: unknown }) {
  const payload = body.payload ?? {};

  switch (body.action) {
    case "save-currency":
      return saveCurrencyForRoute(payload);
    case "register-rate":
      return registerRateForRoute(payload);
    case "change-base-currency":
      return changeBaseCurrencyForRoute(payload);
    case "update-locale":
      return updateLocaleForRoute(payload);
    case "save-payment-method":
      return savePaymentMethodForRoute(payload);
    case "save-entity":
      return saveEntityForRoute(payload);
    default:
      throw new MoneyError(422, "VALIDATION_ERROR", "Esa acción de Finanzas no existe.", {
        action: "Elegí qué guardar.",
      });
  }
}

export async function writeFinanceForRoute(request: Request) {
  await requireFinanceOwner();

  const body = (await request.json().catch(() => ({}))) as { action?: string; payload?: unknown };

  return NextResponse.json({ data: await runFinanceCommand(body) }, { headers: FINANCE_NO_STORE });
}

export { financeErrorResponse as financeError };
