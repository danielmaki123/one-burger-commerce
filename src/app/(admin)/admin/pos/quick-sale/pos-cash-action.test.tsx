// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PosCashAction from "./pos-cash-action";

/**
 * La acción de **caja** dentro del checkout.
 *
 * La ley que esta pieza implementa (`SCREEN-POS-QUICK-SALE-001.1` §5): el POS **no** tiene enlaces
 * permanentes a Caja. Cuando la caja abierta es de otro día operativo, la acción que corresponde es
 * **cerrarla** (y no se ofrece abrir otra); cuando no hay turno, la acción es **abrirla**. Las dos viven
 * donde el cobro está bloqueado —el checkout— y no en la barra operativa.
 *
 * `shiftLoading` deja el bloque fuera: mientras se lee la caja no se afirma que esté cerrada.
 */
afterEach(cleanup);

describe("PosCashAction", () => {
  it("sin turno ofrece abrir la caja", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <PosCashAction state="no-shift" loading={false} busy={false} error={null} onAction={onAction} />,
    );

    expect(screen.getByText("Caja cerrada")).toBeTruthy();
    expect(screen.getByText("Abrí una caja para cobrar.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Abrir caja" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("con un turno de otro día pide cerrarlo y NO ofrece abrir", () => {
    render(
      <PosCashAction
        state="pending-close"
        loading={false}
        busy={false}
        error={null}
        onAction={() => {}}
      />,
    );

    expect(screen.getByText("Cierre pendiente")).toBeTruthy();
    expect(screen.getByText("La caja pertenece al turno anterior.")).toBeTruthy();
    // El cierre firma el arqueo: vive en Caja y desde acá se enlaza.
    const cerrar = screen.getByRole("link", { name: "Cerrar caja" });
    expect(cerrar.getAttribute("href")).toBe("/admin/cash");
    expect(screen.queryByRole("button", { name: "Abrir caja" })).toBeNull();
  });

  it("mientras se lee la caja no afirma que esté cerrada", () => {
    render(
      <PosCashAction state="no-shift" loading busy={false} error={null} onAction={() => {}} />,
    );

    expect(screen.queryByText("Caja cerrada")).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir caja" })).toBeNull();
    expect(screen.getByText("Leyendo la caja…")).toBeTruthy();
  });

  it("cuando la acción corre, el botón lo dice y no se puede repetir", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <PosCashAction state="no-shift" loading={false} busy error={null} onAction={onAction} />,
    );

    const boton = screen.getByRole("button", { name: "Abriendo…" });
    expect(boton.hasAttribute("disabled")).toBe(true);

    await user.click(boton);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("si la acción falla, el motivo se lee en el bloque", () => {
    render(
      <PosCashAction
        state="no-shift"
        loading={false}
        busy={false}
        error="No se pudo abrir la caja."
        onAction={() => {}}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("No se pudo abrir la caja.");
  });

  it("con la caja abierta no dibuja nada: el estado vive en la barra, no acá", () => {
    const { container } = render(
      <PosCashAction state="open" loading={false} busy={false} error={null} onAction={() => {}} />,
    );

    expect(container.textContent).toBe("");
  });
});
