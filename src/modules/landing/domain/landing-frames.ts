/**
 * Secuencia de frames del landing.
 *
 * Los números salen tal cual del mock aprobado
 * (`one burger/frames-scroll-hamburguesa - Copy/mockup-scroll-hamburguesa.html`):
 * son 37 frames del video, no los 120. Para usar la secuencia completa alcanza
 * con cambiar `LANDING_FRAME_NUMBERS` por el rango 1..120.
 */
export const LANDING_FRAME_NUMBERS: number[] = [
  45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 80, 81, 82, 83, 113, 114, 115, 116, 117, 118, 119, 120,
];

const FRAME_DIRECTORY = "/landing/frames";

function frameFileName(frameNumber: number): string {
  return `burger_${String(frameNumber).padStart(4, "0")}.webp`;
}

/** Ruta pública del frame en la posición indicada. */
export function framePathForIndex(index: number): string {
  const safeIndex = Math.min(
    Math.max(Math.trunc(index) || 0, 0),
    LANDING_FRAME_NUMBERS.length - 1,
  );

  return `${FRAME_DIRECTORY}/${frameFileName(LANDING_FRAME_NUMBERS[safeIndex])}`;
}

/** Frame que corresponde a un progreso de scroll entre 0 y 1. */
export function resolveFrameIndex(progress: number, frameCount = LANDING_FRAME_NUMBERS.length): number {
  if (frameCount <= 1) return 0;

  const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.min(frameCount - 1, Math.max(0, Math.round(safeProgress * (frameCount - 1))));
}

/**
 * Progreso del scroll dentro del escenario, de 0 (entra) a 1 (sale).
 *
 * Es la cuenta que hace el mock, pero aislada del DOM para poder probarla.
 */
export function resolveScrollProgress({
  stageTop,
  stageHeight,
  viewportHeight,
}: {
  stageTop: number;
  stageHeight: number;
  viewportHeight: number;
}): number {
  const scrollable = stageHeight - viewportHeight;
  if (!Number.isFinite(scrollable) || scrollable <= 0) return 0;

  const travelled = -stageTop / scrollable;
  if (!Number.isFinite(travelled)) return 0;

  return Math.min(1, Math.max(0, travelled));
}
