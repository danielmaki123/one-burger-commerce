import { NextResponse } from "next/server";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { MoneyError } from "@/modules/money/domain/money-errors";
import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el mapeo de errores y las cabeceras de `GET /api/admin/finance`.
 *
 * Una configuración financiera **no se cachea**: el dueño guarda una tasa y la respuesta siguiente tiene que
 * traerla. Y un error se responde con la forma que el resto del panel ya entiende (`error.message` y
 * `error.fields`), sin filtrar el detalle interno.
 */
export const FINANCE_NO_STORE = { "Cache-Control": "no-store" } as const;

export function financeErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: FINANCE_NO_STORE },
    );
  }

  if (error instanceof MoneyError || error instanceof OrderError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status, headers: FINANCE_NO_STORE },
    );
  }

  console.error(
    "[finance]",
    error instanceof Error ? error.message : String(error),
  );

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "No pudimos leer la configuración financiera." } },
    { status: 500, headers: FINANCE_NO_STORE },
  );
}
