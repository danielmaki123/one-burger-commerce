// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { printLinesMock } = vi.hoisted(() => ({ printLinesMock: vi.fn((_lines: string[]) => true) }));

vi.mock("@/shared/lib/print-lines", () => ({ printLines: printLinesMock }));
import OrderInvoicePanel from "./order-invoice-panel";

/**
 * Factura simple (2026-09-18) — el documento en el detalle del pedido.
 *
 * Lo que se prueba: el `GET` decide si se ofrece emitir (solo quien cobra), emitir manda los datos fiscales
 * del cliente, el documento emitido se muestra **congelado** y el botón lo imprime con la hoja del sistema
 * (el navegador lo guarda como PDF).
 */

afterEach(cleanup);

const currency = { symbol: "C$", locale: "es-NI" };

const invoice = {
  id: "inv_01",
  number: "F-000001",
  orderId: "ord_01",
  status: "emitted" as const,
  customerName: "Ana",
  customerLegalName: null,
  customerTaxId: null,
  businessName: "One Burger",
  businessLegalName: null,
  businessTaxId: null,
  businessAddress: null,
  businessPhone: null,
  currencyCode: "NIO",
  subtotal: 100,
  discount: 0,
  packagingAmount: 0,
  deliveryFeeAmount: 0,
  tipAmount: 0,
  total: 100,
  issuedAt: "2026-09-18T15:00:00.000Z",
  issuedByUserId: "admin_1",
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

function renderPanel() {
  return render(<OrderInvoicePanel orderId="ord_01" currency={currency} />);
}

describe("OrderInvoicePanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ data: { invoice, reused: false } }, true, 201);

      return jsonResponse({ data: { invoice: null, canEmit: true } });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin factura ofrece emitirla y manda los datos fiscales del cliente", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByLabelText("Razón social del cliente (opcional)");
    await user.type(screen.getByLabelText("Razón social del cliente (opcional)"), "Ana S.A.");
    await user.type(screen.getByLabelText("RUC del cliente (opcional)"), "J0310000001");
    await user.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(screen.getByText("F-000001")).toBeTruthy());
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "POST")!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      legalName: "Ana S.A.",
      taxId: "J0310000001",
    });
  });

  it("con la factura emitida se muestra congelada y se ofrece la hoja de 80 mm para imprimir", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ data: { invoice, canEmit: true } }));
    renderPanel();

    expect(await screen.findByText("F-000001")).toBeTruthy();
    expect(screen.getByText(/100\.00/)).toBeTruthy();

    // La hoja de 80 mm vive en su propia página (con el logo y la sucursal): acá solo se enlaza.
    const imprimir = screen.getByRole("link", { name: "Imprimir o guardar PDF" });
    expect(imprimir.getAttribute("href")).toBe("/admin/orders/ord_01/invoice/print");
    expect(imprimir.getAttribute("target")).toBe("_blank");
  });

  it("quien no cobra no ve el formulario (y con factura emitida la ve igual)", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ data: { invoice: null, canEmit: false } }));
    renderPanel();

    expect(
      await screen.findByText("La factura la emite quien cobra el pedido."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Emitir factura" })).toBeNull();
  });

  it("si el servidor rechaza la emisión, el motivo se muestra tal cual", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse(
          { error: { message: "Ese pedido todavía no tiene ningún cobro: cobralo y volvé a intentar." } },
          false,
          409,
        );
      }

      return jsonResponse({ data: { invoice: null, canEmit: true } });
    });
    renderPanel();

    await screen.findByLabelText("Razón social del cliente (opcional)");
    await user.click(screen.getByRole("button", { name: "Emitir factura" }));

    expect(
      await screen.findByText("Ese pedido todavía no tiene ningún cobro: cobralo y volvé a intentar."),
    ).toBeTruthy();
  });
});
