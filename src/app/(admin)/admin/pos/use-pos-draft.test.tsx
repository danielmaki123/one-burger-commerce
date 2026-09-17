// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addPosLine, createPosDraft } from "@/modules/pos/domain/pos-draft";

import { POS_DRAFT_STORAGE_PREFIX, usePosDraft } from "./use-pos-draft";

/**
 * Bloque 12.3 del roadmap del POS (Fase 2) — la venta en curso sobrevive a la recarga.
 *
 * El hook guarda el borrador en el dispositivo y lo recupera al montar. Se prueba montando el hook de
 * verdad y **bajo `StrictMode`**, que es como corre el POS en desarrollo: el doble montaje es justo lo
 * que hacía perder el carrito del cliente (guardar el estado vacío encima de lo guardado antes de
 * leerlo), así que acá se reproduce a propósito.
 */

function Probe({
  locationId = "loc_centro",
  currencyCode = "NIO",
}: {
  locationId?: string;
  currencyCode?: string;
}) {
  const { draft, setDraft, restored } = usePosDraft(locationId, currencyCode);

  return (
    <div>
      <p data-testid="lineas">{draft.lines.length}</p>
      <p data-testid="restaurado">{restored ? "sí" : "no"}</p>
      <button
        type="button"
        onClick={() =>
          setDraft((current) =>
            addPosLine(current, { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35 }),
          )
        }
      >
        Agregar
      </button>
      <button type="button" onClick={() => setDraft(createPosDraft(locationId))}>
        Vaciar
      </button>
    </div>
  );
}

function renderProbe(props: { locationId?: string; currencyCode?: string } = {}) {
  return render(
    <StrictMode>
      <Probe {...props} />
    </StrictMode>,
  );
}

const key = (locationId = "loc_centro", currencyCode = "NIO") =>
  `${POS_DRAFT_STORAGE_PREFIX}:${locationId}:${currencyCode}`;

function savedDraft(locationId = "loc_centro") {
  return JSON.stringify({
    locationId,
    lines: [{ productId: "seed-prod-02", name: "Taco de Asada", unitPrice: 30, quantity: 3 }],
  });
}

describe("usePosDraft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("recupera la venta en curso que quedó guardada y lo avisa", async () => {
    localStorage.setItem(key(), savedDraft());

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("lineas").textContent).toBe("1"));
    expect(screen.getByTestId("restaurado").textContent).toBe("sí");
    // El guardado no se pisó antes de leerlo: sigue estando.
    expect(localStorage.getItem(key())).toContain("seed-prod-02");
  });

  it("sin nada guardado arranca una venta nueva y sin aviso", async () => {
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("restaurado").textContent).toBe("no"));
    expect(screen.getByTestId("lineas").textContent).toBe("0");
  });

  it("cambiar de local empieza una venta nueva y no toca la del local anterior", async () => {
    localStorage.setItem(key("loc_centro"), savedDraft("loc_centro"));

    const { rerender } = renderProbe({ locationId: "loc_centro" });
    await waitFor(() => expect(screen.getByTestId("lineas").textContent).toBe("1"));

    rerender(
      <StrictMode>
        <Probe locationId="loc_masaya" />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId("lineas").textContent).toBe("0"));
    expect(screen.getByTestId("restaurado").textContent).toBe("no");
    // La venta del local anterior sigue guardada: si el cajero vuelve, la encuentra.
    expect(localStorage.getItem(key("loc_centro"))).toContain("seed-prod-02");
  });

  it("lo que se agrega queda guardado para la próxima recarga", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(localStorage.getItem(key())).toContain("seed-prod-01"));
  });

  it("vaciar la venta borra lo guardado (no reaparece al recargar)", async () => {
    const user = userEvent.setup();
    localStorage.setItem(key(), savedDraft());

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("lineas").textContent).toBe("1"));

    await user.click(screen.getByRole("button", { name: "Vaciar" }));

    await waitFor(() => expect(localStorage.getItem(key())).toBeNull());
    expect(screen.getByTestId("lineas").textContent).toBe("0");
  });

  it("la venta es de un local: la de otra sucursal no se recupera", async () => {
    localStorage.setItem(key("loc_masaya"), savedDraft("loc_masaya"));

    renderProbe({ locationId: "loc_centro" });

    await waitFor(() => expect(screen.getByTestId("restaurado").textContent).toBe("no"));
    expect(screen.getByTestId("lineas").textContent).toBe("0");
    // Y no se borra la de la otra sucursal: si el cajero vuelve, sigue ahí.
    expect(localStorage.getItem(key("loc_masaya"))).toContain("seed-prod-02");
  });
});
