// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderActions } from "./order-actions";

/**
 * B2 — las acciones de una comanda, con el motivo obligatorio y sin dobles toques.
 *
 * Es la parte de la pantalla que **muta** el pedido, así que lo que se prueba es lo que puede salir
 * mal: rechazar sin motivo, tocar dos veces mientras guarda y que el servidor conteste que el pedido
 * ya cambió.
 */
function pickup(status: string) {
  return { id: "ord_1", orderNumber: "OB-1", type: "pickup" as const, status: status as never };
}

afterEach(() => {
  cleanup();
});

describe("acciones de una comanda (B2)", () => {
  it("un pedido nuevo se acepta desde la fila", async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    render(<OrderActions order={pickup("new")} onUpdateStatus={onUpdateStatus} />);

    await user.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith("confirmed", null);
    });
  });

  it("cada etapa ofrece una sola acción primaria, con el nombre de la cocina", () => {
    const { unmount } = render(
      <OrderActions order={pickup("confirmed")} onUpdateStatus={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Preparando" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aceptar" })).toBeNull();
    unmount();

    render(<OrderActions order={pickup("preparing")} onUpdateStatus={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Terminado" })).toBeTruthy();
  });

  it("una comanda lista ya no se rechaza: la entrega el mostrador", () => {
    render(<OrderActions order={pickup("ready_for_pickup")} onUpdateStatus={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Entregada" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rechazar" })).toBeNull();
  });

  it("un pedido cerrado no ofrece nada, en vez de ofrecer algo imposible", () => {
    render(<OrderActions order={pickup("closed")} onUpdateStatus={vi.fn()} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rechazar pide el motivo y no manda nada sin él", async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    render(<OrderActions order={pickup("new")} onUpdateStatus={onUpdateStatus} />);

    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    expect(screen.getByRole("alert").textContent).toMatch(/motivo/i);
    expect(onUpdateStatus).not.toHaveBeenCalled();
  });

  it("con motivo, rechaza y avisa a quien escucha", async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    render(<OrderActions order={pickup("new")} onUpdateStatus={onUpdateStatus} />);

    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await user.type(screen.getByLabelText(/motivo del rechazo/i), "Se quedó sin pan");
    await user.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    await waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith("cancelled", "Se quedó sin pan");
    });
  });

  it("cerrar el motivo no rechaza nada", async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi.fn();
    render(<OrderActions order={pickup("new")} onUpdateStatus={onUpdateStatus} />);

    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText(/motivo del rechazo/i)).toBeNull();
    expect(onUpdateStatus).not.toHaveBeenCalled();
  });

  it("mientras guarda no se puede tocar dos veces", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onUpdateStatus = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<OrderActions order={pickup("new")} onUpdateStatus={onUpdateStatus} />);

    const accept = screen.getByRole("button", { name: "Aceptar" });
    await user.click(accept);

    expect(screen.getByRole("button", { name: /guardando/i }).hasAttribute("disabled")).toBe(true);

    release();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled")).toBe(false);
    });
  });

  it("si el pedido ya cambió de estado, lo dice con el texto del servidor", async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi
      .fn()
      .mockRejectedValue(new Error("El pedido ya cambió de estado. Actualizamos la lista."));
    render(<OrderActions order={pickup("new")} onUpdateStatus={onUpdateStatus} />);

    await user.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/ya cambió de estado/i);
    });
  });

  it("sin conexión las acciones quedan apagadas y con el motivo a la vista", () => {
    render(
      <OrderActions
        order={pickup("new")}
        onUpdateStatus={vi.fn()}
        disabled
        disabledReason="Sin conexión: no se puede cambiar el estado."
      />,
    );

    expect(screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Rechazar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/sin conexión/i)).toBeTruthy();
  });
});
