import * as React from "react";

export interface ColorInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

/**
 * Selector de color del panel.
 *
 * Es el `<input type="color">` nativo envuelto una sola vez: el navegador ya trae la rueda de color, el
 * teclado y el lector de pantalla, y hasta ahora la pantalla de Personalización copiaba el control a
 * mano (con su `className` y sin el mínimo táctil). El hex se sigue editando en su propio campo de
 * texto: acá vive solo la muestra.
 */
export function ColorInput({
  className = "",
  label,
  error,
  id,
  ...props
}: ColorInputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-st-caption font-medium text-ink">
          {label}
        </label>
      ) : null}
      <input
        type="color"
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 w-14 shrink-0 cursor-pointer rounded-stitch-md border border-line-control bg-surface-input p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-st-caption font-medium text-status-sla-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
