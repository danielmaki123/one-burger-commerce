// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isAlertSoundEnabled,
  playNewOrderAlert,
  setAlertSoundEnabled,
} from "./admin-alert-sound";

/**
 * B1 — el aviso sonoro de pedido nuevo.
 *
 * El navegador bloquea el audio hasta que la persona interactúa, así que el sonido es **opt-in**: se
 * activa con un botón, se recuerda en el dispositivo y por defecto está apagado. El tono se genera con
 * `WebAudio` (sin archivo de audio) y, si el navegador no lo expone, no pasa nada: la consola no puede
 * romperse por un beep.
 */

type FakeOscillator = {
  type: string;
  frequency: { value: number };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  oscillators: FakeOscillator[] = [];

  createOscillator(): FakeOscillator {
    const oscillator: FakeOscillator = {
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.oscillators.push(oscillator);

    return oscillator;
  }

  createGain() {
    return {
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

describe("admin-alert-sound", () => {
  let context: FakeAudioContext;

  beforeEach(() => {
    localStorage.clear();
    context = new FakeAudioContext();
    vi.stubGlobal("AudioContext", function AudioContextStub() {
      return context;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("por defecto está apagado y no suena", () => {
    expect(isAlertSoundEnabled()).toBe(false);
    expect(playNewOrderAlert()).toBe(false);
    expect(context.oscillators).toHaveLength(0);
  });

  it("cuando se activa, suena (dos tonos) y la preferencia queda guardada", () => {
    setAlertSoundEnabled(true);

    expect(isAlertSoundEnabled()).toBe(true);
    expect(playNewOrderAlert()).toBe(true);
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(
      true,
    );
    expect(context.oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it("apagarlo de nuevo detiene el aviso", () => {
    setAlertSoundEnabled(true);
    setAlertSoundEnabled(false);

    expect(playNewOrderAlert()).toBe(false);
    expect(context.oscillators).toHaveLength(0);
  });

  it("sin WebAudio no rompe: avisa que no pudo sonar", () => {
    vi.stubGlobal("AudioContext", undefined);
    setAlertSoundEnabled(true);

    expect(playNewOrderAlert()).toBe(false);
  });
});
