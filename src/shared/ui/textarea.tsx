import * as React from "react";

import { HelpText } from "./help-text";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Texto de ayuda del campo; se anuncia junto con el error (`aria-describedby`). */
  description?: string;
}

/**
 * C1-1 de `plan2uiux.md` — el `Textarea` que faltaba.
 *
 * TASK-201 midió **4 `<textarea>` crudos** (recibir y mermar inventario, bloques comerciales y las
 * notas de una comanda) y el design system solo podía decir "usá el mismo `className` que el Input".
 * Esto es ese `className`, una sola vez, con lo que la copia no tenía: etiqueta asociada, error y
 * ayuda anunciados por `aria-describedby` y el foco con el anillo de marca.
 *
 * `min-h-24` es la altura mínima cómoda para escribir en el celular; el alto final lo decide
 * `rows`/`className` de cada pantalla.
 */
export function Textarea({
  className = "",
  label,
  error,
  description,
  id,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const helpId = `${textareaId}-help`;

  const describedBy = [description ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium leading-none text-foreground"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={props.rows ?? 3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`flex min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
      {description && <HelpText id={textareaId}>{description}</HelpText>}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
