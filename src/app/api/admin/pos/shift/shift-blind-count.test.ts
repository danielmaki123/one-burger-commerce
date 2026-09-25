import { describe, expect, it } from "vitest";

import { filterArqueoForRole } from "./shift-arqueo-role-filter";

/**
 * TASK-AUD-003 — **el arqueo ciego no puede ser derivable**.
 *
 * A-45 (2026-09-23) cerró la mitad del problema: el `cashier` dejó de recibir el esperado y la diferencia.
 * Pero el arqueo viaja con sus **sumandos** —fondo, efectivo del turno, movimientos y devoluciones— y el
 * esperado es exactamente su suma:
 *
 *     esperado = fondo + efectivo del turno + movimientos + devoluciones
 *
 * Así que esconder el total y mandar los sumandos no esconde nada: alcanza una resta. Este archivo fija la
 * invariante de verdad: **quien cobra no recibe nada que determine el esperado** — ni el total, ni las
 * partes, ni el desglose por medio de pago (que trae el efectivo adentro).
 *
 * La forma del payload es la real: el corte X devuelve `{ data: <arqueo> }` y el cierre
 * `{ data: <turno>, meta: <arqueo> }`.
 */

/** Lo que el arqueo trae y **determina** el esperado: si el cajero recibe alguno, el ciego no existe. */
const DETERMINING_FIELDS = [
  "expectedAmount",
  "expectedByCurrency",
  "difference",
  "cashSalesAmount",
  "cashMovementsAmount",
  "refundsAmount",
  "refundsByCurrency",
  "tipsAmount",
  "paymentMix",
  "nonCashByCurrency",
  "bankChargedByCurrency",
  "bankDifferenceByCurrency",
  "bankDifferenceAmount",
] as const;

const corteXCompleto = {
  data: {
    shiftId: "shift_01",
    locationId: "loc_principal",
    terminalId: null,
    openedAt: "2026-09-17T14:00:00.000Z",
    generatedAt: "2026-09-17T20:00:00.000Z",
    // El fondo lo declaró el propio cajero al abrir: es su dato y viaja.
    openingAmount: 500,
    // Todo lo de abajo determina el esperado y NO puede viajar.
    expectedAmount: 1300,
    expectedByCurrency: { NIO: 1250, USD: 2 },
    cashSalesAmount: 800,
    cashMovementsAmount: 100,
    refundsAmount: -100,
    refundsByCurrency: { NIO: -100 },
    paymentMix: { orders: 4, cash: 800, card: 500, transfer: 100, other: 0, total: 1400, tips: 20 },
    nonCashByCurrency: { NIO: 600 },
  },
};

const cierreCompleto = {
  data: {
    id: "shift_01",
    locationId: "loc_principal",
    openingAmount: 500,
    closingAmount: 1200,
    expectedAmount: 1300,
    expectedByCurrency: { NIO: 1300 },
    difference: -100,
    cashSalesAmount: 800,
    cashMovementsAmount: 100,
    refundsAmount: -100,
    tipsAmount: 20,
  },
  meta: {
    expectedByCurrency: { NIO: 1300 },
    paymentMix: { orders: 4, cash: 800, card: 500, transfer: 0, other: 0, total: 1300, tips: 0 },
    bankDeclaredByCurrency: { BAC: 500 },
    bankChargedByCurrency: { NIO: 500 },
    bankDifferenceByCurrency: { NIO: 0 },
    bankDifferenceAmount: 0,
  },
};

/** Todas las claves del payload, a cualquier profundidad. */
function keysDeep(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysDeep(entry, found);
    return found;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      found.add(key);
      keysDeep(entry, found);
    }
  }

  return found;
}

/** Suma los sumandos del arqueo tal como los sumaría un cajero con la respuesta en la mano. */
function expectedFromAddends(addends: {
  openingAmount?: number;
  cashSalesAmount?: number;
  cashMovementsAmount?: number;
  refundsAmount?: number;
}): number | null {
  const parts = [
    addends.openingAmount,
    addends.cashSalesAmount,
    addends.cashMovementsAmount,
    addends.refundsAmount,
  ];

  if (parts.some((part) => part === undefined)) return null;

  return parts.reduce<number>((total, part) => total + (part ?? 0), 0);
}

describe("TASK-AUD-003 · el cajero no puede determinar el esperado", () => {
  it("el corte X no le manda ningún campo que determine el esperado", () => {
    const filtrado = filterArqueoForRole(corteXCompleto, "cashier");
    const keys = keysDeep(filtrado);

    const leaked = DETERMINING_FIELDS.filter((field) => keys.has(field));

    expect(
      leaked,
      "esconder el total y mandar los sumandos no esconde nada: el esperado es su suma",
    ).toEqual([]);
  });

  it("el cierre no le manda ningún campo que determine el esperado (ni por `meta`)", () => {
    const filtrado = filterArqueoForRole(cierreCompleto, "cashier");
    const keys = keysDeep(filtrado);

    expect(DETERMINING_FIELDS.filter((field) => keys.has(field))).toEqual([]);
  });

  it("con la respuesta filtrada no se puede reconstruir el esperado por aritmética", () => {
    const filtrado = filterArqueoForRole(corteXCompleto, "cashier");

    expect(expectedFromAddends(filtrado.data)).toBeNull();
    // Y el control: con el payload completo, la resta da el esperado exacto. Es el ataque que se cierra.
    expect(expectedFromAddends(corteXCompleto.data)).toBe(1300);
  });

  it("al cajero le queda lo que sí es suyo: la identidad del turno y el fondo que declaró", () => {
    const filtrado = filterArqueoForRole(corteXCompleto, "cashier");

    expect(filtrado.data.shiftId).toBe("shift_01");
    expect(filtrado.data.locationId).toBe("loc_principal");
    expect(filtrado.data.openedAt).toBe("2026-09-17T14:00:00.000Z");
    expect(filtrado.data.openingAmount).toBe(500);
  });

  it("el cierre sigue mostrándole lo que él contó y lo que declaró en los bancos", () => {
    const filtrado = filterArqueoForRole(cierreCompleto, "cashier");

    expect(filtrado.data.closingAmount).toBe(1200);
    expect(filtrado.meta.bankDeclaredByCurrency).toEqual({ BAC: 500 });
  });

  it("a quien audita no se le toca nada: Manager y Owner siguen viendo el arqueo completo", () => {
    expect(filterArqueoForRole(corteXCompleto, "manager")).toEqual(corteXCompleto);
    expect(filterArqueoForRole(cierreCompleto, "owner")).toEqual(cierreCompleto);
  });

  it("un payload anidado más profundo también se filtra (no es un filtro de primer nivel)", () => {
    const anidado = { data: { turno: { arqueo: { expectedAmount: 1300, cashSalesAmount: 800 } } } };

    expect(keysDeep(filterArqueoForRole(anidado, "cashier"))).toEqual(new Set(["data", "turno", "arqueo"]));
  });

  it("no muta la respuesta original (el aviso al dueño se firma con el arqueo completo)", () => {
    const filtrado = filterArqueoForRole(cierreCompleto, "cashier");

    expect(filtrado).not.toBe(cierreCompleto);
    expect(cierreCompleto.data.expectedAmount).toBe(1300);
    expect(cierreCompleto.meta.paymentMix.cash).toBe(800);
  });
});
