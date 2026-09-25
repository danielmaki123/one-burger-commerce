import { describe, expect, it } from "vitest";

import { canSeeArqueo, filterArqueoForRole } from "./shift-arqueo-role-filter";

/**
 * Hallazgo A-45 del backlog — **el arqueo ciego es una regla de servidor**.
 *
 * La Fase 4 escondió el esperado y la diferencia en la pantalla de Caja, pero el corte X y el cierre
 * seguían devolviéndolos por API a cualquiera que pueda operar el POS: el cajero podía leer con un `curl`
 * el número que la pantalla le ocultaba. Desde este brief, el cajero recibe **solo su conteo** y quien
 * audita (Manager, Owner) sigue recibiendo el arqueo completo.
 */

const corteX = {
  data: {
    shiftId: "shift_01",
    openingAmount: 500,
    expectedAmount: 1300,
    expectedByCurrency: { NIO: 1300 },
    cashSalesAmount: 800,
    paymentMix: { orders: 4, cash: 800, card: 0, transfer: 0, other: 0, total: 800, tips: 0 },
  },
};

const cierre = {
  data: {
    id: "shift_01",
    closingAmount: 1200,
    expectedAmount: 1300,
    expectedByCurrency: { NIO: 1300 },
    difference: -100,
  },
  meta: {
    paymentMix: { orders: 4, cash: 800, card: 500, transfer: 0, other: 0, total: 1300, tips: 0 },
    bankDeclaredByCurrency: { BAC: 500 },
    bankChargedByCurrency: { NIO: 500 },
    bankDifferenceByCurrency: { NIO: 0 },
    bankDifferenceAmount: 0,
  },
};

describe("canSeeArqueo", () => {
  it("el cajero no audita la caja: no ve el esperado ni la diferencia", () => {
    expect(canSeeArqueo("cashier")).toBe(false);
  });

  it("Manager y Owner sí: son quienes auditan", () => {
    expect(canSeeArqueo("manager")).toBe(true);
    expect(canSeeArqueo("owner")).toBe(true);
  });
});

describe("filterArqueoForRole", () => {
  it("al cajero le deja su conteo y le saca el esperado del corte X", () => {
    const filtrado = filterArqueoForRole(corteX, "cashier");

    expect(filtrado.data.shiftId).toBe("shift_01");
    expect(filtrado.data.openingAmount).toBe(500);
    expect(filtrado.data.cashSalesAmount).toBe(800);
    expect(filtrado.data.paymentMix).toEqual(corteX.data.paymentMix);
    expect("expectedAmount" in filtrado.data).toBe(false);
    expect("expectedByCurrency" in filtrado.data).toBe(false);
  });

  it("al cajero le saca el esperado y la diferencia del cierre, incluido el cuadre por banco", () => {
    const filtrado = filterArqueoForRole(cierre, "cashier");

    expect(filtrado.data.closingAmount).toBe(1200);
    expect("difference" in filtrado.data).toBe(false);
    expect("expectedAmount" in filtrado.data).toBe(false);
    expect("expectedByCurrency" in filtrado.data).toBe(false);
    // El `meta` se filtra igual: por ahí viajaba el esperado del cuadre por banco.
    expect(filtrado.meta.paymentMix).toEqual(cierre.meta.paymentMix);
    expect(filtrado.meta.bankDeclaredByCurrency).toEqual({ BAC: 500 });
    expect("bankChargedByCurrency" in filtrado.meta).toBe(false);
    expect("bankDifferenceByCurrency" in filtrado.meta).toBe(false);
    expect("bankDifferenceAmount" in filtrado.meta).toBe(false);
  });

  it("al Manager y al Owner no les toca nada", () => {
    expect(filterArqueoForRole(corteX, "manager")).toEqual(corteX);
    expect(filterArqueoForRole(cierre, "owner")).toEqual(cierre);
  });

  it("no muta la respuesta original (el aviso al dueño usa el arqueo completo)", () => {
    const filtrado = filterArqueoForRole(cierre, "cashier");

    expect(filtrado).not.toBe(cierre);
    expect(cierre.data.difference).toBe(-100);
    expect(cierre.meta.bankDifferenceAmount).toBe(0);
  });

  it("un corte X sin turno abierto (`data: null`) se devuelve igual", () => {
    expect(filterArqueoForRole({ data: null }, "cashier")).toEqual({ data: null });
  });
});
