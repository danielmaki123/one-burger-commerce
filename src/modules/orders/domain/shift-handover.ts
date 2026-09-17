import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * Tarea 7 del brief (2026-09-17) — el **traspaso de caja entre cajeros** (1.13).
 *
 * El turno tiene un solo responsable (`Shift.userId` = quién abrió) y el local no admite dos cajas
 * abiertas a la vez. Cuando el cajero se va y otro sigue cobrando, la caja **no se cierra**: se traspasa.
 * Lo que se firma es el **corte X** de ese momento —lo que el sistema espera que haya en el cajón— y los
 * nombres de quien entrega y quien recibe, para que la plata tenga un responsable en todo momento.
 *
 * Este archivo tiene la regla y el tipo, sin base de datos: el nombre se normaliza, tiene un tope y no
 * puede ser el de quien entrega (si es el mismo, no hubo traspaso).
 */

/** Lo que se guarda de un traspaso. Los montos van congelados al momento de firmarlo. */
export type ShiftHandoverRecord = {
  id: string;
  shiftId: string;
  locationId: string;
  /** Quién entrega: el usuario del panel que registra el traspaso. `null` si no se pudo resolver. */
  handedByUserId: string | null;
  handedByName: string | null;
  /** Quién recibe, tal como se firmó (texto libre: el que sigue no siempre tiene usuario del panel). */
  receivedByName: string;
  /** El esperado del corte X en el momento de firmar. */
  expectedAmount: number;
  expectedByCurrency: Record<string, number> | null;
  notes: string | null;
  createdAt: string;
};

/** Un nombre de persona, no un párrafo: 80 caracteres es de sobra para nombre y apellidos. */
export const HANDOVER_RECEIVER_MAX_LENGTH = 80;

/** Espacios de sobra y saltos de línea afuera: `" maría  lópez "` y `"María López"` son la misma persona. */
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sameName(left: string, right: string): boolean {
  return normalizeName(left).toLocaleLowerCase() === normalizeName(right).toLocaleLowerCase();
}

/**
 * El nombre de quien recibe, normalizado — o el error que explica por qué no sirve. Devuelve el nombre
 * para que el caso de uso guarde **ese** y no el crudo del formulario.
 */
export function resolveHandoverReceiver(input: {
  receivedByName: string | null | undefined;
  handedByName?: string | null;
}): string {
  const received = normalizeName(input.receivedByName ?? "");

  if (!received) {
    throw new OrderError(400, "VALIDATION_ERROR", "Escribí quién recibe la caja.", {
      receivedByName: "Hace falta el nombre de quien recibe.",
    });
  }

  if (received.length > HANDOVER_RECEIVER_MAX_LENGTH) {
    throw new OrderError(
      400,
      "VALIDATION_ERROR",
      `El nombre de quien recibe no puede pasar de ${HANDOVER_RECEIVER_MAX_LENGTH} caracteres.`,
      { receivedByName: `Máximo ${HANDOVER_RECEIVER_MAX_LENGTH} caracteres.` },
    );
  }

  if (input.handedByName && sameName(received, input.handedByName)) {
    throw new OrderError(
      400,
      "VALIDATION_ERROR",
      "Quien entrega y quien recibe no pueden ser la misma persona.",
      { receivedByName: "Ese es el nombre de quien entrega." },
    );
  }

  return received;
}
