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
  const { draft, setDraft, restored, attemptKey, renewAttemptKey, restoreAttemptKey } = usePosDraft(
    locationId,
    currencyCode,
  );

  return (
    <div>
      <p data-testid="lineas">{draft.lines.length}</p>
      <p data-testid="restaurado">{restored ? "sí" : "no"}</p>
      <p data-testid="clave">{attemptKey}</p>
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
      <button type="button" onClick={renewAttemptKey}>
        Renovar clave
      </button>
      <button
        type="button"
        onClick={() => restoreAttemptKey("ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f")}
      >
        Retomar clave
      </button>
      <button type="button" onClick={() => restoreAttemptKey("a".repeat(200))}>
        Retomar clave inválida
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

  /**
   * Tarea 11 del brief (2026-09-17) — la **clave del intento de cobro** sobrevive a la recarga.
   *
   * Es el caso del cobro que quedó a medias: el cajero aprieta Cobrar, la red se corta (o la pantalla se
   * recarga) y vuelve a intentar. Con la clave guardada, el servidor reconoce la misma operación; con una
   * clave nueva, cobraría dos veces.
   */
  it("la clave del intento viaja con el borrador y vuelve a estar al recargar", async () => {
    const clave = "ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
    localStorage.setItem(
      key(),
      JSON.stringify({
        locationId: "loc_centro",
        lines: [{ productId: "seed-prod-02", name: "Taco de Asada", unitPrice: 30, quantity: 3 }],
        attemptKey: clave,
      }),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("lineas").textContent).toBe("1"));
    expect(screen.getByTestId("clave").textContent).toBe(clave);
    // Y se vuelve a guardar con el borrador (una recarga más sigue siendo el mismo intento).
    expect(localStorage.getItem(key())).toContain(clave);
  });

  it("un guardado viejo sin clave arranca con una clave nueva", async () => {
    localStorage.setItem(key(), savedDraft());

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("lineas").textContent).toBe("1"));
    expect(screen.getByTestId("clave").textContent).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("renovar la clave cambia el intento (la venta que viene es otra operación)", async () => {
    const user = userEvent.setup();
    renderProbe();

    const antes = screen.getByTestId("clave").textContent;
    await user.click(screen.getByRole("button", { name: "Renovar clave" }));

    await waitFor(() => expect(screen.getByTestId("clave").textContent).not.toBe(antes));
  });

  it("cambiar de local también renueva la clave", async () => {
    const { rerender } = renderProbe({ locationId: "loc_centro" });
    const antes = screen.getByTestId("clave").textContent;

    rerender(
      <StrictMode>
        <Probe locationId="loc_masaya" />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId("clave").textContent).not.toBe(antes));
  });

  /**
   * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — retomar una venta en espera.
   *
   * La espera lleva la clave del intento con la que se armó: si el cajero la guardó después de un cobro que
   * quedó a medias, volver a cobrarla tiene que ser **el mismo intento** para el servidor. Por eso retomar
   * no renueva la clave: la repone.
   */
  it("retomar una venta en espera devuelve su clave de intento", async () => {
    const user = userEvent.setup();
    const clave = "ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Agregar" }));
    await user.click(screen.getByRole("button", { name: "Retomar clave" }));

    await waitFor(() => expect(screen.getByTestId("clave").textContent).toBe(clave));
    // Y viaja con el borrador: una recarga más sigue siendo el mismo intento.
    expect(localStorage.getItem(key())).toContain(clave);
  });

  it("una clave que el servidor rechazaría no reemplaza a la del intento en curso", async () => {
    const user = userEvent.setup();
    renderProbe();

    const antes = screen.getByTestId("clave").textContent;
    await user.click(screen.getByRole("button", { name: "Retomar clave inválida" }));

    expect(screen.getByTestId("clave").textContent).toBe(antes);
  });
});
