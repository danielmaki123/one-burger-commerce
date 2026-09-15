import * as React from "react";

interface HelpTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /**
   * El `id` del control que explica. El primitivo arma `${id}-help`, que es el que el control
   * referencia en su `aria-describedby` (mismo sufijo que usa el error: `${id}-error`).
   */
  id: string;
  tone?: "default" | "error";
}

/**
 * C1-1 de `plan2uiux.md` — el `HelpText` que faltaba.
 *
 * Es el texto de ayuda de un campo ("Se guarda en minúsculas y con guiones"), el que evita que el
 * usuario adivine el formato. Hoy son 18 párrafos con la misma forma copiada en cada hoja de edición.
 *
 * `role="note"` a propósito: el texto **no** puede ser un `role="alert"` (no es un error) ni quedar
 * mudo (un lector de pantalla lo tiene que poder recorrer); y el control lo referencia por `id`, así
 * que el anuncio llega cuando el campo recibe el foco.
 */
export function HelpText({ id, tone = "default", className = "", ...props }: HelpTextProps) {
  return (
    <p
      id={`${id}-help`}
      role="note"
      className={`text-xs leading-snug ${
        tone === "error" ? "font-medium text-danger-strong" : "text-muted-foreground"
      } ${className}`}
      {...props}
    />
  );
}
