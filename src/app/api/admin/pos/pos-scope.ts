import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

/**
 * Tarea 7 del brief (2026-09-17) — la sesión y el local del POS, en un solo paso.
 *
 * Las rutas del mostrador empiezan igual: quién entra, de qué sucursal es la operación y qué pidió la
 * pantalla. Repetir esas tres líneas en cada handler es lo que hace que un `route.ts` se pase de su tope
 * de 50 líneas; acá queda dicho una vez y el orden (rol → sucursal → POS prendido) sigue siendo el de
 * `requirePosLocation`.
 *
 * El local sale del cuerpo cuando la ruta lo manda (POST) y de la query cuando no (GET).
 */
export async function requirePosScope(request: Request, requestedLocationId?: string) {
  const session = await requireAdminSession();
  const { searchParams } = new URL(request.url);

  const locationId = await requirePosLocation({
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
    requested: requestedLocationId ?? searchParams.get("locationId") ?? "",
  });

  return { session, locationId, searchParams };
}
