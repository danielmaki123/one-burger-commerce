// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReconciliationPanel from "./reconciliation-panel";

/**
 * Tarea 10 del brief (2026-09-17) — la **conciliación de tarjeta y transferencia** en Caja del día
 * (11.1/11.2).
 *
 * Lo que fijan estos casos: los totales que se muestran son los que devolvió el **servidor** (la pantalla
 * no suma), el CSV que se baja tiene las filas del día y el nombre de la sucursal, lo que no es tarjeta ni
 * transferencia se informa **aparte** en vez de esconderse, y sin cobros no se ofrece un archivo vacío.
 */

const downloadTextFileMock = vi.fn((_input: { fileName: string; content: string }) => true);
vi.mock("@/shared/lib/download-file", () => ({
  downloadTextFile: (input: { fileName: string; content: string }) =>
    downloadTextFileMock(input),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const cardPayment = {
  id: "pay_01",
  orderId: "ord_01",
  method: "card" as const,
  amount: 500,
  currency: null,
  changeAmount: 0,
  tip: 0,
  reference: "VOUCHER-1",
  createdAt: "2026-09-17T15:00:00.000Z",
};

const transferPayment = { ...cardPayment, id: "pay_02", orderId: "ord_02", method: "transfer" as const };

const payload = {
  data: {
    date: "2026-09-17",
    locationId: "loc_principal",
    payments: [cardPayment, transferPayment],
    summary: {
      methods: [
        { method: "card", count: 1, byCurrency: { NIO: 500 } },
        { method: "transfer", count: 1, byCurrency: { NIO: 1200 } },
      ],
      others: { count: 0, byCurrency: {} },
    },
  },
};

const locations = [{ id: "loc_principal", name: "Camino de Oriente" }];

describe("ReconciliationPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    downloadTextFileMock.mockClear();
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/cash/reconciliation?")) return jsonResponse(payload);
      return jsonResponse({ data: null });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderPanel() {
    return render(
      <ReconciliationPanel locations={locations} defaultDate="2026-09-17" />,
    );
  }

  it("pide el día del negocio y muestra tarjeta y transferencia por separado", async () => {
    renderPanel();

    const filas = await screen.findAllByRole("listitem");
    const tarjeta = filas[0]?.textContent ?? "";
    const transferencia = filas[1]?.textContent ?? "";

    expect(tarjeta).toContain("Tarjeta");
    expect(tarjeta).toContain("1 cobro");
    expect(tarjeta).toContain("C$500.00");
    expect(transferencia).toContain("Transferencia");
    expect(transferencia).toContain("C$1,200.00");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("date=2026-09-17");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("locationId=loc_principal");
  });

  it("baja el CSV con las filas del día y el nombre del archivo", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Descargar CSV" }));

    const input = downloadTextFileMock.mock.calls[0]?.[0];
    expect(input?.fileName).toBe("conciliacion-camino-de-oriente-2026-09-17.csv");
    expect(input?.content).toContain("Tarjeta");
    expect(input?.content).toContain("VOUCHER-1");
  });

  it("avisa de lo que no entra en el export en vez de esconderlo", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({
        data: {
          ...payload.data,
          summary: {
            ...payload.data.summary,
            others: { count: 2, byCurrency: { NIO: 300 } },
          },
        },
      }),
    );
    renderPanel();

    const otras = await screen.findByText(/Otras formas/);
    expect(otras.textContent).toContain("2");
    expect(otras.textContent).toContain("C$300.00");
  });

  it("sin cobros lo dice y no ofrece un archivo vacío", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({
        data: {
          date: "2026-09-17",
          locationId: "loc_principal",
          payments: [],
          summary: {
            methods: [
              { method: "card", count: 0, byCurrency: {} },
              { method: "transfer", count: 0, byCurrency: {} },
            ],
            others: { count: 0, byCurrency: {} },
          },
        },
      }),
    );
    renderPanel();

    expect(await screen.findByText(/no entró nada por tarjeta ni transferencia/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Descargar CSV" })).toBeNull();
  });

  it("si el servidor falla lo dice y no baja nada", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ error: { message: "Insufficient permissions" } }, 403),
    );
    renderPanel();

    expect((await screen.findByRole("alert")).textContent).toContain("Insufficient permissions");
    expect(screen.queryByRole("button", { name: "Descargar CSV" })).toBeNull();
  });
});
