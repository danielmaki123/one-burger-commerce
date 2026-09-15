import * as React from "react";
import { X } from "lucide-react";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastProps {
  tone: ToastTone;
  /** Una o dos líneas. El aviso no explica la pantalla: dice qué pasó. */
  message: string;
  /** Cierra el aviso. Sin esto el aviso queda en pantalla hasta el próximo guardado. */
  onDismiss?: () => void;
}

const TONES: Record<ToastTone, { container: string; text: string }> = {
  success: { container: "border-success-strong bg-success", text: "text-success-foreground" },
  error: { container: "border-danger-strong bg-danger", text: "text-danger-foreground" },
  warning: { container: "border-warning-strong bg-warning", text: "text-warning-foreground" },
  info: { container: "border-border bg-secondary", text: "text-secondary-foreground" },
};

/**
 * C1-1 de `plan2uiux.md` — el `Toast` que faltaba.
 *
 * Hoy cada pantalla del panel resuelve su confirmación con un `<p role="status">` propio y un color
 * distinto: **11 pantallas** y 26 bloques de aviso medidos. Esto es ese bloque, una sola vez.
 *
 * Decisión de accesibilidad: `role="status"` para `success`/`info` (no interrumpe) y `role="alert"`
 * para `error`/`warning` (se anuncia de inmediato). El aviso de error tiene que cortar; el de éxito,
 * no. El color sale de los tokens `--success/--danger/--warning`, nunca de paleta cruda.
 */
export function Toast({ tone, message, onDismiss }: ToastProps) {
  const tokens = TONES[tone];

  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm font-medium ${tokens.container} ${tokens.text}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar el aviso"
          className="shrink-0 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
