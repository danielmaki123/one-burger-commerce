// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Skeleton, SkeletonAnnouncement } from "./skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("es decorativo: no entra en el árbol accesible y no se anuncia", () => {
    render(<Skeleton data-testid="bone" />);

    expect(screen.getByTestId("bone").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el pulso se apaga con motion-reduce y el alto sale del tamaño pedido", () => {
    render(<Skeleton data-testid="bone" height="card" />);

    const classes = screen.getByTestId("bone").className;

    expect(classes).toContain("motion-reduce:animate-none");
    expect(classes).toContain("h-32");
    expect(classes).toContain("bg-secondary");
  });

  it("la carga se anuncia una sola vez, con el texto que le pasa la pantalla", () => {
    render(<SkeletonAnnouncement label="Cargando locales…" />);

    expect(screen.getByRole("status").textContent).toBe("Cargando locales…");
  });
});
