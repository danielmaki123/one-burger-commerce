// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import CashSkeleton from "./cash-skeleton";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — el estado **Cargando** de `/admin/cash`.
 *
 * El sistema pide `Skeleton` para una pantalla con datos: los huesos son decorativos (`aria-hidden`) y la
 * carga se anuncia una sola vez con `SkeletonAnnouncement`, en palabras.
 */

describe("CashSkeleton", () => {
  afterEach(() => {
    cleanup();
  });

  it("anuncia que está leyendo el estado de la caja", () => {
    render(<CashSkeleton />);

    expect(screen.getByRole("status").textContent).toContain("Leyendo el estado de la caja");
  });
});
