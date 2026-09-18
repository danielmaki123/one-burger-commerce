import type { PosDraftLine } from "./pos-draft";
import { readPosDraftLine, serializePosDraftLine } from "./pos-draft-storage";
import { isPosPaymentMethod, type PosPaymentMethod } from "./pos-sale";
import { createSaleAttemptKey, isSaleAttemptKey } from "./pos-sale-attempt";

/**
 * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — la venta **en espera** del mostrador.
 *
 * El POS tiene un caso que no es ni el borrador ni el pedido: el cliente no está listo todavía (fue a
 * buscar la billetera, se olvidó algo, vuelve en diez minutos) y el cajero **no puede** dejar la pantalla
 * ocupada, porque atrás hay otra gente. «Guardar en espera» deja esa venta a un lado y libera el mostrador
 * para el próximo cliente; «Retomar» la trae de vuelta completa —productos, cliente y el cobro armado—.
 *
 * **Vive en el dispositivo**, igual que el borrador (Bloque 12.3) y por el mismo motivo: todavía **no es un
 * pedido** (no hay nada que cobrar, ni comanda, ni historial que auditar), así que no hay nada que el
 * servidor tenga que guardar y la espera no puede depender de la red. Es una decisión, no una omisión: la
 * espera es de **esta** terminal —el cajero la dejó en la pantalla que tiene adelante— y el día que haya
 * que retomarla desde otra caja, eso pide una entidad y una ruta propias.
 *
 * Tres reglas que no son obvias:
 *
 * 1. **La clave del intento de cobro viaja con la espera** (tarea 11). Si el cajero dejó la venta en espera
 *    justo después de un cobro que quedó a medias (se cortó la red), retomarla y cobrar tiene que seguir
 *    siendo **el mismo intento** para el servidor; con una clave nueva se cobraría dos veces.
 * 2. **El tope es de 8.** Una lista de esperas es una lista de clientes parados en el mostrador: más de
 *    ocho es una fila que nadie va a atender y un cajero que ya no se acuerda de cuál es cuál.
 * 3. **El texto guardado se lee defensivamente**: un guardado viejo, incompleto o escrito a mano no puede
 *    romper el mostrador. Se cae la espera sin líneas recuperables y la línea o el cobro con basura, pero
 *    nunca las otras esperas: perder la venta de un cliente que está esperando es peor que perder un dato.
 */

/** Los cobros que se estaban armando, con el monto **como texto**: al retomar se corrige, no se adivina. */
export type PosHeldPayment = {
  method: PosPaymentMethod;
  currency: string;
  amount: string;
  /** Referencia del voucher o de la transferencia (Bloque 4.1). */
  reference?: string;
};

export type PosHeldSale = {
  id: string;
  /** Cuándo se dejó en espera (ISO). `""` cuando el guardado no traía una fecha legible. */
  savedAt: string;
  lines: PosDraftLine[];
  customer: {
    name: string;
    whatsapp: string;
    email: string;
    /**
     * Punto 4 del roadmap (2026-09-18) — la factura con RUC que el cajero dejó a medio cargar. Es opcional
     * para que una venta guardada antes de este cambio se siga pudiendo retomar (sin factura).
     */
    fiscal?: { wantsInvoice: boolean; taxId: string; legalName: string };
  };
  payments: PosHeldPayment[];
  /** `null` cuando el guardado es viejo o la clave no sirve: al retomar se genera una nueva. */
  attemptKey: string | null;
};

/** Más de ocho esperas es una fila de clientes que ya nadie está atendiendo. */
export const MAX_POS_HELDS = 8;

/**
 * El id de la espera, generado en el dispositivo. Se reusa la fábrica de la clave del intento porque el
 * requisito es el mismo —un UUID único sin coordinarse con nadie— y no hace falta una segunda.
 */
export function createPosHoldId(): string {
  return createSaleAttemptKey();
}

/** La espera nueva va **primero**: es la que el cajero acaba de dejar y la que va a volver a tocar. */
export function addPosHold(holds: readonly PosHeldSale[], hold: PosHeldSale): PosHeldSale[] {
  // Con la lista llena no crece: se cae la última, que es la más vieja. La pantalla bloquea el botón
  // antes de llegar acá; esto es la red que evita que una lista de esperas crezca sin fin.
  return [hold, ...holds].slice(0, MAX_POS_HELDS);
}

export function removePosHold(holds: readonly PosHeldSale[], id: string): PosHeldSale[] {
  return holds.filter((hold) => hold.id !== id);
}

export function posHoldsFull(holds: readonly PosHeldSale[]): boolean {
  return holds.length >= MAX_POS_HELDS;
}

/** Cómo se nombra la espera en la lista: el cliente. Sin nombre igual se puede retomar. */
export function posHoldTitle(hold: PosHeldSale): string {
  const name = hold.customer.name.trim();

  return name === "" ? "Sin nombre" : name;
}

/** Las unidades de la venta (suma de cantidades): es lo que el cajero cuenta de un vistazo. */
export function posHoldUnits(hold: PosHeldSale): number {
  return hold.lines.reduce((units, line) => units + line.quantity, 0);
}

function readPayment(value: unknown): PosHeldPayment | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<PosHeldPayment>;
  const currency = typeof candidate.currency === "string" ? candidate.currency.trim() : "";
  const reference = typeof candidate.reference === "string" ? candidate.reference : undefined;

  if (typeof candidate.method !== "string" || !isPosPaymentMethod(candidate.method)) return null;
  if (currency === "") return null;
  // El monto es texto: un número guardado por error no se convierte, porque el cobro se rearma en pantalla.
  if (typeof candidate.amount !== "string") return null;

  return {
    method: candidate.method,
    currency,
    amount: candidate.amount,
    ...(reference === undefined ? {} : { reference }),
  };
}

function readCustomer(value: unknown): PosHeldSale["customer"] {
  if (typeof value !== "object" || value === null) {
    return { name: "", whatsapp: "", email: "" };
  }

  const candidate = value as Partial<PosHeldSale["customer"]>;
  // Los espacios de los costados son de la pantalla, no del cliente: "  " no es un nombre.
  const text = (field: unknown) => (typeof field === "string" ? field.trim() : "");

  /**
   * Punto 4 — la factura que el cajero dejó cargada. Solo se restaura si de verdad venía marcada: un
   * guardado viejo (sin el campo) retoma sin factura, que es el estado por defecto.
   */
  const fiscalCandidate = (candidate as { fiscal?: unknown }).fiscal;
  const fiscal =
    typeof fiscalCandidate === "object" &&
    fiscalCandidate !== null &&
    (fiscalCandidate as { wantsInvoice?: unknown }).wantsInvoice === true
      ? {
          wantsInvoice: true,
          taxId: text((fiscalCandidate as { taxId?: unknown }).taxId),
          legalName: text((fiscalCandidate as { legalName?: unknown }).legalName),
        }
      : undefined;

  return {
    name: text(candidate.name),
    whatsapp: text(candidate.whatsapp),
    email: text(candidate.email),
    ...(fiscal ? { fiscal } : {}),
  };
}

function readHold(value: unknown): PosHeldSale | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as Partial<PosHeldSale>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";

  // Sin id no se puede retomar ni descartar: es una espera que solo se podría mirar.
  if (id === "") return null;
  if (!Array.isArray(candidate.lines)) return null;

  const lines = candidate.lines
    .map(readPosDraftLine)
    .filter((line): line is PosDraftLine => line !== null);

  // Sin líneas no hay venta que retomar (una espera vacía es ruido en la lista).
  if (lines.length === 0) return null;

  const payments = Array.isArray(candidate.payments)
    ? candidate.payments.map(readPayment).filter((payment): payment is PosHeldPayment => payment !== null)
    : [];

  const savedAt =
    typeof candidate.savedAt === "string" && !Number.isNaN(Date.parse(candidate.savedAt))
      ? candidate.savedAt
      : "";

  return {
    id,
    savedAt,
    lines,
    customer: readCustomer(candidate.customer),
    payments,
    attemptKey: isSaleAttemptKey(candidate.attemptKey) ? candidate.attemptKey : null,
  };
}

/** El texto que se guarda en el dispositivo: las esperas de **un** local. */
export function serializePosHolds(locationId: string, holds: readonly PosHeldSale[]): string {
  return JSON.stringify({
    locationId,
    holds: holds.map((hold) => ({
      id: hold.id,
      savedAt: hold.savedAt,
      lines: hold.lines.map(serializePosDraftLine),
      customer: {
        name: hold.customer.name,
        whatsapp: hold.customer.whatsapp,
        email: hold.customer.email,
      },
      payments: hold.payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency,
        amount: payment.amount,
        ...(payment.reference === undefined ? {} : { reference: payment.reference }),
      })),
      ...(isSaleAttemptKey(hold.attemptKey) ? { attemptKey: hold.attemptKey } : {}),
    })),
  });
}

/**
 * Lee las esperas guardadas para **ese** local. Un guardado de otra sucursal no se ofrece: la venta en
 * espera lleva los precios y el catálogo del local donde se armó.
 */
export function parsePosHolds(raw: string | null, locationId: string): PosHeldSale[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null) return [];

  const candidate = parsed as { locationId?: unknown; holds?: unknown };
  if (candidate.locationId !== locationId) return [];
  if (!Array.isArray(candidate.holds)) return [];

  return candidate.holds
    .map(readHold)
    .filter((hold): hold is PosHeldSale => hold !== null)
    .slice(0, MAX_POS_HELDS);
}
