// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import CashError from "./cash-error";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **Error** de `/admin/cash`.
 *
 * Antes no existía: un `fetch` fallido se dibujaba como «Sin caja abierta en este local» (A-44) y no había
 * forma de volver a intentar sin recargar. Este componente es el que dice que falló y ofrece el reintento.
 */

describe("CashError", () => {
  afterEach(() => {
    cleanup();
  });

  it("anuncia el error y ofrece reintentar", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<CashError message="Admin session expired" onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toContain("Admin session expired");

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("explica que el reintento sirve, sin prometer que el problema ya está resuelto", () => {
    render(<CashError message="No se pudo leer el estado de la caja." onRetry={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toContain(
      "No se pudo leer el estado de la caja.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
