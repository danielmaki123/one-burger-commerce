import { describe, expect, it } from "vitest";

import { cashCountKey, cashCountTotalFor, toCashCountRows } from "./cash-count-grid";

/**
 * TASK-305b — la cuenta de la grilla de billetes.
 *
 * Es plata contada por una persona: los helpers tienen que ignorar los billetes que no se contaron
 * (cero) y no mandar filas vacías, porque el servidor rechaza el mismo billete dos veces y una fila
 * en cero no es un conteo.
 */

describe("grilla de conteo", () => {
  it("suma por moneda y por billete", () => {
    const values = {
      [cashCountKey("NIO", 100)]: 5,
      [cashCountKey("NIO", 50)]: 2,
      [cashCountKey("USD", 20)]: 3,
    };

    expect(cashCountTotalFor(values, "NIO")).toBe(600);
    expect(cashCountTotalFor(values, "USD")).toBe(60);
    expect(cashCountTotalFor(values, "EUR")).toBe(0);
  });

  it("no manda filas de billetes que no se contaron", () => {
    const values = { [cashCountKey("NIO", 100)]: 2, [cashCountKey("NIO", 20)]: 0 };

    expect(toCashCountRows(values, ["NIO", "USD"])).toEqual([
      { currency: "NIO", denomination: 100, quantity: 2 },
    ]);
  });

  it("una caja vacía no manda nada", () => {
    expect(toCashCountRows({}, ["NIO", "USD"])).toEqual([]);
  });
});
