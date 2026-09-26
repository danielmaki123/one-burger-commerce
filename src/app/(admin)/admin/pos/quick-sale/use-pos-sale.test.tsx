// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PosDraftLine } from "@/modules/pos/domain/pos-draft";
import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import { EMPTY_POS_FISCAL_DRAFT } from "../pos-fiscal-payload";
import { usePosSale } from "./use-pos-sale";

/**
 * El cobro del mostrador: cotización del cupón, validación de pantalla, alta con idempotencia y limpieza.
 *
 * Se prueba contra el **servidor simulado**: lo que viaja en el `POST` (clave del intento, cupón, forma y
 * monto del descuento, datos del cliente) es el contrato con la ruta, y lo que se muestra después del cobro
 * (el recibo del último cobro) es lo que usan los tickets.
 */

const currency = DEFAULT_CURRENCY_FORMAT;

const draftLines: PosDraftLine[] = [
  { productId: "prod_taco", name: "Taco de birria", unitPrice: 35, packagingUnitAmount: 5, quantity: 1 },
];

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response);
}

function setup(overrides: Partial<Parameters<typeof usePosSale>[0]> = {}) {
  const onSaleCharged = vi.fn();
  const onHold = vi.fn();
  const renewAttemptKey = vi.fn();

  const currentParams: Parameters<typeof usePosSale>[0] = {
    locationId: "loc_norte",
    terminalId: null,
    currencyCode: "NIO",
    currency,
    fiscal: EMPTY_POS_FISCAL_DRAFT,
    customer: { name: "Cliente Mostrador", whatsapp: "88887777", email: "" },
    attempt: { attemptKey: "11111111-2222-4333-8444-555555555555", renewAttemptKey, restoreAttemptKey: () => {} },
    draft: { locationId: "loc_norte", lines: draftLines },
    onSaleCharged,
    onHold,
    ...overrides,
  };

  const rendered = renderHook(() => usePosSale(currentParams));

  return { ...rendered, onSaleCharged, onHold, renewAttemptKey, params: currentParams, currentParams };
}

describe("usePosSale", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("arranca con una fila de cobro en efectivo, en la moneda del negocio, y sin total cobrado", () => {
    const { result } = setup();

    expect(result.current.payments).toHaveLength(1);
    expect(result.current.payments[0]!.method).toBe("cash");
    expect(result.current.payments[0]!.currency).toBe("NIO");
    expect(result.current.lastSale).toBeNull();
    expect(result.current.charging).toBe(false);
  });

  it("cotiza el cupón contra el servidor y lo aplica al total que se muestra", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({
        data: {
          coupon: { code: "BIENVENIDA10", type: "percentage", value: 10, description: null },
          discount: 3.5,
        },
      }),
    );

    const { result } = setup();

    await act(async () => {
      await result.current.applyCoupon("BIENVENIDA10");
    });

    expect(result.current.coupon?.code).toBe("BIENVENIDA10");
    expect(result.current.coupon?.discount).toBe(3.5);
    expect(result.current.couponError).toBeNull();
  });

  it("un código que el servidor rechaza no toca el total y dice el motivo", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ error: { message: "Ese código no existe." } }, false),
    );

    const { result } = setup();

    await act(async () => {
      await result.current.applyCoupon("NOEXISTE");
    });

    expect(result.current.coupon).toBeNull();
    expect(result.current.couponError).toBe("Ese código no existe.");
  });

  it("la cotización de una venta que cambió deja de valer", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({
        data: { coupon: { code: "X", type: "percentage", value: 10, description: null }, discount: 3.5 },
      }),
    );

    let currentLines: PosDraftLine[] = [...draftLines];
    const { result, rerender, currentParams } = setup({
      draft: { locationId: "loc_norte", lines: currentLines },
    });

    await act(async () => {
      await result.current.applyCoupon("X");
    });
    expect(result.current.coupon).not.toBeNull();

    // Otra ronda de la misma venta: la cotización era de lo que había antes.
    currentLines = [...draftLines, { productId: "prod_cola", name: "Cola", unitPrice: 25, quantity: 1 }];
    currentParams.draft = { locationId: "loc_norte", lines: currentLines };
    rerender();

    expect(result.current.coupon).toBeNull();
    expect(result.current.couponStale).toBe(true);
  });

  it("no manda nada si falta el nombre o el monto: lo dice en los campos", async () => {
    const { result } = setup({ customer: { name: "  ", whatsapp: "", email: "" } });

    await act(async () => {
      await result.current.charge();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldErrors.name).toBe("Escribí el nombre del cliente.");
    expect(result.current.fieldErrors.whatsapp).toBe("Escribí el número del cliente.");
    expect(result.current.fieldErrors.amount).toBe("Escribí con cuánto paga el cliente.");
    expect(result.current.saleError).toBe("Revisá los datos marcados.");
  });

  it("con la factura pedida, el RUC corto frena el cobro antes del viaje", async () => {
    const { result } = setup({
      fiscal: { wantsInvoice: true, taxId: "J0310", legalName: "Distribuidora" },
    });

    await act(async () => {
      await result.current.charge();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fieldErrors.taxId).toContain("al menos 8 caracteres");
  });

  it("manda la venta con su clave de intento, el cupón y el descuento manual", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/pos/coupon") {
        return jsonResponse({
          data: { coupon: { code: "PROMO", type: "percentage", value: 10, description: null }, discount: 4 },
        });
      }

      return jsonResponse({
        data: {
          orderId: "ord_1",
          orderNumber: "P-ABC123",
          total: 36,
          change: 64,
          reused: false,
          payments: [{ method: "cash", amount: 100, currency: "NIO" }],
        },
      });
    });

    const { result } = setup();

    await act(async () => {
      await result.current.applyCoupon("PROMO");
    });
    await act(async () => {
      result.current.setManualDiscount({
        kind: "amount",
        value: 5,
        reason: "Cliente de siempre",
        amount: 5,
      });
    });
    await act(async () => {
      result.current.setPayments([
        { id: "pay_1", method: "cash", currency: "NIO", amount: "100" },
      ]);
    });
    await act(async () => {
      await result.current.charge();
    });

    const saleCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/admin/pos/sale");
    const body = JSON.parse(String((saleCall![1] as RequestInit).body));

    expect(body.idempotencyKey).toBe("11111111-2222-4333-8444-555555555555");
    expect(body.couponCode).toBe("PROMO");
    expect(body.manualDiscount).toEqual({
      kind: "amount",
      value: 5,
      reason: "Cliente de siempre",
    });
    expect(body.payments).toEqual([{ method: "cash", currency: "NIO", amount: 100 }]);
    expect(body.customer).toEqual({
      name: "Cliente Mostrador",
      whatsapp: "88887777",
      email: null,
      taxId: null,
      legalName: null,
    });
  });

  it("después de cobrar limpia el mostrador, renueva el intento y deja el recibo del cobro", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({
        data: {
          orderId: "ord_1",
          orderNumber: "P-ABC123",
          total: 40,
          change: 60,
          reused: false,
          payments: [{ method: "cash", amount: 100, currency: "NIO" }],
        },
      }),
    );

    const { result, onSaleCharged, renewAttemptKey } = setup();

    await act(async () => {
      result.current.setPayments([{ id: "pay_1", method: "cash", currency: "NIO", amount: "100" }]);
    });
    await act(async () => {
      await result.current.charge();
    });

    const lastSale = result.current.lastSale;
    expect(lastSale?.orderNumber).toBe("P-ABC123");
    expect(lastSale?.receipt.subtotal).toBe(35);
    expect(lastSale?.receipt.packagingAmount).toBe(5);
    expect(lastSale?.chargedAt).toBeTruthy();
    expect(renewAttemptKey).toHaveBeenCalledTimes(1);
    expect(onSaleCharged).toHaveBeenCalledTimes(1);
    expect(result.current.payments).toEqual([
      { id: "pay_1", method: "cash", currency: "NIO", amount: "" },
    ]);
  });

  it("cuando el servidor rechaza el cobro, el error se muestra y el intento no se renueva", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ error: { message: "El cobro supera lo que falta." } }, false),
    );

    const { result, renewAttemptKey } = setup();

    await act(async () => {
      result.current.setPayments([{ id: "pay_1", method: "cash", currency: "NIO", amount: "100" }]);
    });
    await act(async () => {
      await result.current.charge();
    });

    expect(result.current.saleError).toBe("El cobro supera lo que falta.");
    expect(renewAttemptKey).not.toHaveBeenCalled();
    expect(result.current.lastSale).toBeNull();
  });

  it("sin red, el cobro avisa y no pierde lo que el cajero armó", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));

    const { result } = setup();

    await act(async () => {
      result.current.setPayments([{ id: "pay_1", method: "cash", currency: "NIO", amount: "100" }]);
    });
    await act(async () => {
      await result.current.charge();
    });

    expect(result.current.saleError).toBe("No se pudo cobrar: revisá la conexión y reintentá.");
    expect(result.current.payments[0]!.amount).toBe("100");
  });

  it("limpiar el cobro armado no borra el recibo del último cobro", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({
        data: {
          orderId: "ord_1",
          orderNumber: "P-ABC123",
          total: 40,
          change: 60,
          reused: false,
          payments: [{ method: "cash", amount: 100, currency: "NIO" }],
        },
      }),
    );

    const { result } = setup();

    await act(async () => {
      result.current.setPayments([{ id: "pay_1", method: "cash", currency: "NIO", amount: "100" }]);
    });
    await act(async () => {
      await result.current.charge();
    });

    expect(result.current.lastSale?.orderNumber).toBe("P-ABC123");

    // Vaciar la venta (o dejarla en espera) no puede llevarse la confirmación: el recibo y los tickets
    // salen de ahí.
    await act(async () => {
      result.current.resetSale();
    });
    expect(result.current.lastSale?.orderNumber).toBe("P-ABC123");

    // Arrancar una venta nueva —lo que hace cambiar de local— sí la suelta.
    await act(async () => {
      result.current.startNewSale();
    });
    expect(result.current.lastSale).toBeNull();
  });

  it("dejar en espera se lleva la venta armada y su clave de intento", async () => {
    const { result, onHold, renewAttemptKey } = setup();

    await act(async () => {
      result.current.setPayments([
        { id: "pay_1", method: "cash", currency: "NIO", amount: "100", reference: "voucher" },
      ]);
    });
    await act(async () => {
      result.current.hold();
    });

    expect(onHold).toHaveBeenCalledWith({
      lines: draftLines,
      payments: [{ method: "cash", currency: "NIO", amount: "100", reference: "voucher" }],
      attemptKey: "11111111-2222-4333-8444-555555555555",
    });
    expect(renewAttemptKey).toHaveBeenCalledTimes(1);
    expect(result.current.payments[0]!.amount).toBe("");
  });
});
