// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PosOrderChargePanel from "./pos-order-charge-panel";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **cobrar un pedido del menú desde el POS**.
 *
 * Hasta acá un pedido del menú público no tenía forma de cobrarse desde el panel: sin cobro, `emit-invoice`
 * lo rechaza con 409 y la factura era imposible. El panel busca por número contra `GET /api/admin/orders`,
 * precarga el total (que es lo que se cobra, salvo que el cliente pague otra cosa) y registra el cobro en
 * `POST /api/admin/orders/{id}/payment` con la terminal que cobra, para que el cobro entre a **su** arqueo
 * (Fase 6). Los errores del servidor —pedido ya cobrado, monto que pasa el total, sin permiso— se muestran
 * tal cual: son la explicación de por qué no se pudo cobrar.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const currency = { symbol: "C$", locale: "es-NI" };

const order = {
  id: "ord_512",
  orderNumber: "P-MUDF8E1K",
  customerName: "Ana Pérez",
  total: 280,
  status: "new",
};

function renderPanel(props: { terminalId?: string | null } = {}) {
  return render(
    <PosOrderChargePanel
      currencies={["NIO", "USD"]}
      currency={currency}
      terminalId={"terminalId" in props ? (props.terminalId ?? null) : "term_1"}
    />,
  );
}

type FetchCall = { url: string; init?: RequestInit };

/** Un solo doble de `fetch` que responde por URL: la búsqueda y el cobro son llamadas distintas. */
function stubFetch(
  handlers: {
    search?: { status: number; body: unknown };
    payment?: { status: number; body: unknown };
  } = {},
) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const { status, body } = url.endsWith("/payment")
      ? (handlers.payment ?? { status: 201, body: { data: { id: "pay_1" } } })
      : (handlers.search ?? { status: 200, body: { data: [order] } });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function paymentCall(calls: FetchCall[]) {
  const posted = calls.find((call) => call.url.endsWith("/payment"));
  expect(posted).toBeTruthy();
  return JSON.parse(String(posted?.init?.body)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("PosOrderChargePanel", () => {
  it("busca por número, precarga el total y cobra atribuyendo el cobro a la terminal", async () => {
    const user = userEvent.setup();
    const calls = stubFetch();
    renderPanel({ terminalId: "term_1" });

    await user.type(screen.getByLabelText("Número de pedido"), "P-MUDF8E1K");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(calls[0].url).toBe("/api/admin/orders?search=P-MUDF8E1K");
    expect(await screen.findByText(/Ana Pérez/)).toBeTruthy();
    expect((screen.getByLabelText("Monto cobrado") as HTMLInputElement).value).toBe("280");

    await user.click(screen.getByRole("button", { name: "Registrar cobro" }));

    const posted = calls.find((call) => call.url.endsWith("/payment"));
    expect(posted?.url).toBe("/api/admin/orders/ord_512/payment");
    expect(posted?.init?.method).toBe("POST");
    expect(paymentCall(calls)).toEqual({
      method: "cash",
      amount: 280,
      currency: "NIO",
      reference: null,
      terminalId: "term_1",
    });

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("P-MUDF8E1K quedó cobrado");
    });
  });

  it("sin terminal el cobro viaja igual (la caja sin terminal lee por ventana de tiempo)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch();
    renderPanel({ terminalId: null });

    await user.type(screen.getByLabelText("Número de pedido"), "P-MUDF8E1K");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText(/Ana Pérez/);
    await user.click(screen.getByRole("button", { name: "Registrar cobro" }));

    expect(paymentCall(calls).terminalId).toBeNull();
  });

  it("un número que no existe no deja cobrar nada", async () => {
    const user = userEvent.setup();
    stubFetch({ search: { status: 200, body: { data: [] } } });
    renderPanel();

    await user.type(screen.getByLabelText("Número de pedido"), "P-NOEXISTE");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No encontramos un pedido con ese número.",
    );
    expect(screen.queryByRole("button", { name: "Registrar cobro" })).toBeNull();
  });

  it("muestra el motivo del servidor cuando el cobro no entra (ya cobrado)", async () => {
    const user = userEvent.setup();
    stubFetch({
      payment: {
        status: 409,
        body: { error: { code: "CONFLICT", message: "Ese pedido ya está cobrado." } },
      },
    });
    renderPanel();

    await user.type(screen.getByLabelText("Número de pedido"), "P-MUDF8E1K");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText(/Ana Pérez/);
    await user.click(screen.getByRole("button", { name: "Registrar cobro" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Ese pedido ya está cobrado.");
  });

  it("un monto que pasa el total lo explica el campo que devolvió el servidor", async () => {
    const user = userEvent.setup();
    stubFetch({
      payment: {
        status: 409,
        body: {
          error: {
            code: "CONFLICT",
            message: "Revisá el cobro.",
            fields: { amount: "El cobro pasa el total del pedido." },
          },
        },
      },
    });
    renderPanel();

    await user.type(screen.getByLabelText("Número de pedido"), "P-MUDF8E1K");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText(/Ana Pérez/);
    await user.click(screen.getByRole("button", { name: "Registrar cobro" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "El cobro pasa el total del pedido.",
    );
  });
});
