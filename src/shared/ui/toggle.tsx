import * as React from "react";
import { LoaderCircle } from "lucide-react";

interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** Estado actual del interruptor. */
  checked: boolean;
  /** Se llama con el estado **contrario** al actual: la pantalla no calcula `!checked`. */
  onChange: (next: boolean) => void;
  /** Etiqueta accesible obligatoria: el interruptor se dibuja sin texto. */
  label: string;
  /** Mientras guarda: se deshabilita y muestra el giro en lugar de la pastilla. */
  saving?: boolean;
}

/**
 * C1-1 de `plan2uiux.md` — el `Toggle` que faltaba.
 *
 * Es el interruptor de "Disponible" de la grilla de productos: un `<button>` con `role="switch"` y
 * `aria-checked`, no un `<input type="checkbox">` estilizado (el checkbox nativo no acepta el pulgar
 * deslizante y su estado ya lo cubre `Checkbox`).
 *
 * Lo que fija el primitivo, y por eso no se copia más:
 *
 * - El mínimo táctil de 44 px (`min-h-11 min-w-11`) va **en el control**, no en cada pantalla.
 * - El estado se anuncia: `aria-checked` para el lector y `bg-brand`/`bg-secondary` para el ojo.
 * - `saving` es una prop y no un estado local: el que sabe si está guardando es el caso de uso.
 */
export function Toggle({
  checked,
  onChange,
  label,
  saving = false,
  disabled = false,
  className = "",
  ...props
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || saving}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {saving ? (
        <LoaderCircle
          className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <span
          aria-hidden="true"
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors motion-reduce:transition-none",
            checked ? "bg-brand" : "bg-secondary",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform motion-reduce:transition-none",
              checked ? "translate-x-5.5" : "translate-x-0.5",
            ].join(" ")}
          />
        </span>
      )}
    </button>
  );
}
