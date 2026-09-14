import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  /** Opciones simples. Para casos que necesitan agrupar o algo a medida, se pasan `children`. */
  options?: SelectOption[];
  /** Opción vacía al principio, para los campos opcionales (por ejemplo "Elegí una opción"). */
  placeholder?: string;
}

/**
 * TASK-206 — el `Select` que faltaba.
 *
 * TASK-201 midió **31 `<select>` crudos** y `SELECT_CLASS` redefinido en 8 archivos, y el design
 * system solo podía recomendar copiar el `className` idéntico. Esto es esa copia, una sola vez y con
 * lo que la copia no tenía: etiqueta asociada por `htmlFor`, error anunciado con `aria-describedby` y
 * el mínimo táctil de 44 px en el propio primitivo (no en cada pantalla).
 *
 * Sigue siendo un `<select>` **nativo** a propósito: es lo que da el teclado del celular, el
 * comportamiento accesible del navegador y lo que `selectOption` de Playwright sabe manejar.
 */
export function Select({
  className = "",
  label,
  error,
  options,
  placeholder,
  id,
  children,
  ...props
}: SelectProps) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium leading-none text-foreground">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`flex min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}
