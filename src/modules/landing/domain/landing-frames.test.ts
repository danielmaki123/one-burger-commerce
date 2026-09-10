import { describe, expect, it } from "vitest";

import {
  LANDING_FRAME_NUMBERS,
  framePathForIndex,
  resolveFrameIndex,
  resolveScrollProgress,
  shouldRevealMenuButton,
} from "@/modules/landing/domain/landing-frames";

describe("secuencia de frames del landing", () => {
  it("usa exactamente los frames del mock, en ese orden", () => {
    // El mock (`mockup-scroll-hamburguesa.html`) lista estos 37 frames: los 25
    // primeros son consecutivos y despues salta al 80 y al 113.
    expect(LANDING_FRAME_NUMBERS).toHaveLength(37);
    expect(LANDING_FRAME_NUMBERS.slice(0, 3)).toEqual([45, 46, 47]);
    expect(LANDING_FRAME_NUMBERS.slice(24, 26)).toEqual([69, 80]);
    expect(LANDING_FRAME_NUMBERS.slice(-2)).toEqual([119, 120]);
  });

  it("arma la ruta publica con el numero rellenado a cuatro digitos", () => {
    expect(framePathForIndex(0)).toBe("/landing/frames/burger_0045.webp");
    expect(framePathForIndex(36)).toBe("/landing/frames/burger_0120.webp");
  });
});

describe("resolveFrameIndex", () => {
  it("reparte la secuencia completa a lo largo del scroll", () => {
    expect(resolveFrameIndex(0, 37)).toBe(0);
    expect(resolveFrameIndex(1, 37)).toBe(36);
    expect(resolveFrameIndex(0.5, 37)).toBe(18);
  });

  it("recorta fuera de rango", () => {
    expect(resolveFrameIndex(-0.4, 37)).toBe(0);
    expect(resolveFrameIndex(1.8, 37)).toBe(36);
    expect(resolveFrameIndex(Number.NaN, 37)).toBe(0);
  });

  it("no rompe con una secuencia vacia", () => {
    expect(resolveFrameIndex(0.5, 0)).toBe(0);
  });
});

describe("shouldRevealMenuButton", () => {
  it("el boton aparece recien cuando la animacion llega al ultimo frame", () => {
    expect(shouldRevealMenuButton(0)).toBe(false);
    expect(shouldRevealMenuButton(0.5)).toBe(false);
    expect(shouldRevealMenuButton(0.9)).toBe(false);
    expect(shouldRevealMenuButton(1)).toBe(true);
  });

  it("se revela en el mismo punto en que se muestra el ultimo frame", () => {
    const lastFrameProgress =
      (LANDING_FRAME_NUMBERS.length - 1 - 0.5) / (LANDING_FRAME_NUMBERS.length - 1);

    expect(resolveFrameIndex(lastFrameProgress)).toBe(LANDING_FRAME_NUMBERS.length - 1);
    expect(shouldRevealMenuButton(lastFrameProgress)).toBe(true);
    expect(shouldRevealMenuButton(lastFrameProgress - 0.01)).toBe(false);
  });

  it("no se revela con un progreso invalido", () => {
    expect(shouldRevealMenuButton(Number.NaN)).toBe(false);
  });
});

describe("resolveScrollProgress", () => {
  it("va de 0 a 1 a medida que el escenario pasa por el viewport", () => {
    // Escenario de 285vh con viewport de 1000px: recorrido de 1850px.
    expect(resolveScrollProgress({ stageTop: 0, stageHeight: 2850, viewportHeight: 1000 })).toBe(0);
    expect(
      resolveScrollProgress({ stageTop: -925, stageHeight: 2850, viewportHeight: 1000 }),
    ).toBeCloseTo(0.5, 5);
    expect(
      resolveScrollProgress({ stageTop: -1850, stageHeight: 2850, viewportHeight: 1000 }),
    ).toBe(1);
  });

  it("recorta antes de entrar y despues de salir", () => {
    expect(resolveScrollProgress({ stageTop: 400, stageHeight: 2850, viewportHeight: 1000 })).toBe(0);
    expect(
      resolveScrollProgress({ stageTop: -4000, stageHeight: 2850, viewportHeight: 1000 }),
    ).toBe(1);
  });

  it("devuelve 0 cuando el escenario no tiene recorrido", () => {
    expect(resolveScrollProgress({ stageTop: -100, stageHeight: 800, viewportHeight: 1000 })).toBe(0);
  });
});
