// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FacturasClient } from "./facturas-client";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Facturas**.
 *
 * Lo que se prueba acá es lo que la persona hace: filtrar, ver el documento, reimprimirlo y —solo el
 * dueño— anular con un motivo. Anular **no borra**: la fila pasa a «Anulada» sin desaparecer de la lista,
 * que es justo lo que un documento entregado necesita.
 *
 * jsdom no implementa el modo modal del `<dialog>` (igual que en `modal.test.tsx`): se le agrega el mínimo.
 */

beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_01",
    number: "F-000001",
    orderId: "ord_01",
    status: "emitted",
    customerName: "Ana",
    branchName: "Camino de Oriente",
    total: 380,
    issuedAt: "2026-09-18T15:00:00.000Z",
    voidReason: null,
    ...overrides,
  };
}

function stubFetch(rows: unknown[], onVoid?: (body: unknown) => { ok: boolean; payload: unknown }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      const result = onVoid?.(body) ?? { ok: true, payload: { data: { ...invoiceRow(), status: "voided" } } };

      return {
        ok: result.ok,
        json: async () => result.payload,
      };
    }

    return { ok: true, json: async () => ({ data: rows }) };
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("Historial › Facturas", () => {
  it("lista las facturas con su número, cliente, sucursal y total", async () => {
    stubFetch([invoiceRow()]);
    render(<FacturasClient canVoid />);

    expect(await screen.findByText("F-000001")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Camino de Oriente")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reimprimir" }).getAttribute("href")).toBe(
      "/admin/orders/ord_01/invoice/print",
    );
  });

  it("el botón Anular es solo del dueño", async () => {
    stubFetch([invoiceRow()]);
    render(<FacturasClient canVoid={false} />);

    await screen.findByText("F-000001");
    expect(screen.queryByRole("button", { name: "Anular" })).toBeNull();
  });

  it("el buscador viaja a la consulta", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch([invoiceRow()]);
    render(<FacturasClient canVoid />);

    await screen.findByText("F-000001");
    await user.type(screen.getByPlaceholderText("Número o cliente"), "F-000001");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("search=F-000001")),
      ).toBe(true),
    );
  });

  it("anular pide el motivo de la lista y deja la fila como anulada", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch([invoiceRow()]);
    render(<FacturasClient canVoid />);

    await screen.findByText("F-000001");
    await user.click(screen.getByRole("button", { name: "Anular" }));

    const dialog = screen.getByRole("dialog");
    // Los cinco motivos acordados, con «Otro» al final.
    const options = within(dialog)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "Error de emisión",
      "Devolución al cliente",
      "Cancelación del pedido",
      "Corrección de datos",
      "Otro",
    ]);

    await user.click(within(dialog).getByRole("button", { name: "Anular factura" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).includes("/api/admin/invoices/inv_01/void") &&
            (init as RequestInit | undefined)?.method === "POST",
        ),
      ).toBe(true),
    );

    expect(await screen.findByTestId("invoices-notice")).toBeTruthy();
    // La fila queda anulada y **sigue en la lista**: el documento no se borra.
    expect(screen.getByText("F-000001")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Anular" })).toBeNull();
  });

  it("«Otro» pide el texto antes de mandar nada", async () => {
    const user = userEvent.setup();
    stubFetch([invoiceRow()], () => ({ ok: false, payload: { error: { message: "Falta el motivo" } } }));
    render(<FacturasClient canVoid />);

    await screen.findByText("F-000001");
    await user.click(screen.getByRole("button", { name: "Anular" }));
    await user.selectOptions(screen.getByLabelText("Motivo"), "otro");

    expect(screen.getByLabelText("Contá el motivo")).toBeTruthy();
  });

  it("si la anulación falla, se dice por qué y la factura sigue emitida", async () => {
    const user = userEvent.setup();
    stubFetch([invoiceRow()], () => ({
      ok: false,
      payload: { error: { message: "Esa factura ya está anulada." } },
    }));
    render(<FacturasClient canVoid />);

    await screen.findByText("F-000001");
    await user.click(screen.getByRole("button", { name: "Anular" }));
    await user.click(screen.getByRole("button", { name: "Anular factura" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Emitida")).toBeTruthy();
  });
});
