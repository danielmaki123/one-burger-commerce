import { describe, expect, it } from "vitest";

import { OrderError } from "@/modules/orders/domain/order-errors";

import { HANDOVER_RECEIVER_MAX_LENGTH, resolveHandoverReceiver } from "./shift-handover";

/**
 * Tarea 7 del brief (2026-09-17) — el **traspaso de caja entre cajeros** (1.13): la firma de quién
 * recibe.
 *
 * El traspaso existe para que la plata tenga un responsable en todo momento; por eso la regla es corta
 * pero estricta: se firma con un nombre de verdad (no vacío, no un párrafo) y **nadie se entrega la caja
 * a sí mismo** — si el nombre de quien entrega y el de quien recibe son el mismo, no hubo traspaso.
 */

describe("resolveHandoverReceiver", () => {
  it("deja el nombre prolijo: sin espacios de sobra", () => {
    expect(resolveHandoverReceiver({ receivedByName: "  María   López  " })).toBe("María López");
  });

  it("sin nombre no hay traspaso a quién echarle la culpa", () => {
    expect(() => resolveHandoverReceiver({ receivedByName: "   " })).toThrow(OrderError);
    expect(() => resolveHandoverReceiver({ receivedByName: null })).toThrow(
      /Escribí quién recibe la caja/,
    );
  });

  it(`un nombre de más de ${HANDOVER_RECEIVER_MAX_LENGTH} caracteres es un texto, no un nombre`, () => {
    expect(() => resolveHandoverReceiver({ receivedByName: "a".repeat(81) })).toThrow(
      /80 caracteres/,
    );
  });

  it("nadie se entrega la caja a sí mismo", () => {
    expect(() =>
      resolveHandoverReceiver({ receivedByName: "María López", handedByName: "María López" }),
    ).toThrow(/misma persona/);
  });

  it("el mismo nombre escrito distinto tampoco es un traspaso", () => {
    expect(() =>
      resolveHandoverReceiver({ receivedByName: " maría   lópez ", handedByName: "María López" }),
    ).toThrow(/misma persona/);
  });

  it("si no se sabe quién entrega, solo se valida el nombre", () => {
    expect(
      resolveHandoverReceiver({ receivedByName: "Carlos Ruiz", handedByName: null }),
    ).toBe("Carlos Ruiz");
  });
});
