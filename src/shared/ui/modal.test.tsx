// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Modal } from "./modal";

/**
 * jsdom no implementa el modo modal del `<dialog>`: tiene el elemento y el atributo `open`, pero no
 * `showModal()`. Se le agrega el mínimo para poder verificar lo que el **primitivo** aporta
 * (semántica, título, Escape, click de fondo, cierre por botón); el foco atrapado y el `::backdrop`
 * son del navegador y se comprueban en el E2E, no acá.
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

afterEach(cleanup);

describe("Modal", () => {
  it("se abre como diálogo y se cierra al pedirlo la pantalla", () => {
    const { rerender } = render(
      <Modal open={false} onClose={() => {}} title="Borrar local">
        <p>contenido</p>
      </Modal>,
    );

    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    rerender(
      <Modal open onClose={() => {}} title="Borrar local">
        <p>contenido</p>
      </Modal>,
    );
    expect(dialog.open).toBe(true);

    rerender(
      <Modal open={false} onClose={() => {}} title="Borrar local">
        <p>contenido</p>
      </Modal>,
    );
    expect(dialog.open).toBe(false);
  });

  it("el título nombra al diálogo", () => {
    render(
      <Modal open onClose={() => {}} title="¿Borrar el local?">
        <p>Los pedidos nuevos no van a poder elegirlo.</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "¿Borrar el local?" });

    expect(screen.getByRole("heading", { name: "¿Borrar el local?" })).toBeTruthy();
    expect(dialog.getAttribute("aria-labelledby")).toBe(
      screen.getByRole("heading", { name: "¿Borrar el local?" }).id,
    );
  });

  it("Escape pide el cierre en vez de cerrarse por su cuenta", async () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Cerrar con Escape">
        <p>contenido</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect((dialog as HTMLDialogElement).open).toBe(true);
  });

  it("el botón de cierre y el click de fondo piden el cierre", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Cerrar">
        <p>contenido</p>
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click dentro del contenido: no cierra.
    await user.click(screen.getByText("contenido"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click en el propio diálogo (fuera del contenido): cierra.
    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
