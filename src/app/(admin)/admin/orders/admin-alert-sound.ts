/**
 * B1 — el aviso sonoro de un pedido nuevo, sin archivo de audio.
 *
 * Los navegadores bloquean el audio hasta que la persona interactúa con la página, así que el sonido
 * es **opt-in**: arranca apagado, se activa con un botón y la preferencia queda en el dispositivo.
 * El tono se genera con `WebAudio` (dos notas cortas) y, si el navegador no lo expone, la consola
 * sigue funcionando: un beep no puede romper la pantalla de la cocina.
 */

const STORAGE_KEY = "admin-orders-alert-sound";

/** Dos notas cortas: la primera llama la atención, la segunda confirma. */
const TONES = [
  { frequency: 880, startOffset: 0, duration: 0.12 },
  { frequency: 1174.66, startOffset: 0.16, duration: 0.16 },
] as const;

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;

  const candidate = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return candidate;
}

export function isAlertSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    // Un navegador con el almacenamiento bloqueado no puede impedir el aviso visual.
    return false;
  }
}

export function setAlertSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;

  try {
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, "on");
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ídem: la preferencia no se recuerda, pero la pantalla sigue.
  }
}

/**
 * Suena el aviso. Devuelve `false` cuando no sonó (apagado o sin `WebAudio`), que es lo que usan los
 * tests y lo que permite no mentirle a nadie: si el sonido no está disponible, el aviso visual queda.
 */
export function playNewOrderAlert(): boolean {
  if (!isAlertSoundEnabled()) return false;

  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return false;

  try {
    const context = new AudioContextConstructor();
    void context.resume?.().catch(() => undefined);

    for (const tone of TONES) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + tone.startOffset;

      oscillator.type = "sine";
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + tone.duration);
    }

    return true;
  } catch {
    return false;
  }
}
