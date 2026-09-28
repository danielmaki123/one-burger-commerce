"use client";

import * as React from "react";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **la tabla de Finanzas**, tal como la congela la referencia aprobada.
 *
 * La referencia declara la composición de cada vista como una grilla de columnas:
 *
 * ```text
 * Medios de pago   medio · tipo · entidad · monedas · estado · acciones
 * Monedas y tasas  código · moneda · símbolo · tasa vigente · estado · acciones
 * Entidades        nombre · tipo · utilizada por · estado · acciones
 * ```
 *
 * Eso es **contrato** (`Reference Fidelity`): la información y su orden no se reinterpretan. Lo que **no**
 * se copia del HTML de la referencia es su CSS: acá se usan los tokens semánticos del panel
 * (`ops/design/DESIGN_SYSTEM.md`), no los colores crudos del mock.
 *
 * Por qué una grilla y no un `<table>`: en el teléfono la tabla no entra —el Viewport Contract prohíbe el
 * scroll horizontal— y la SPEC pide que cada fila se convierta en una **tarjeta compacta** con la misma
 * jerarquía. Con una grilla, apilada a una columna en móvil, el mismo componente sirve para los dos sin
 * duplicar el marcado. En escritorio, `overflow-x-auto` vive **dentro** del contenedor de la tabla, nunca en
 * la página.
 */

export type AdminTableProps = {
  /** Rótulos de las columnas, en el orden congelado. La última suele ser de acciones (sin rótulo). */
  columns: string[];
  /** Clases de grilla por punto de corte: la referencia define una por vista. */
  gridClassName: string;
  /** El cuerpo: una fila por entidad, con el mismo número de celdas que `columns`. */
  children: React.ReactNode;
  /** Rótulo accesible de la tabla (no hay `<table>`, así que el grupo necesita nombre). */
  label: string;
  /** Estado vacío: cuando no hay filas, se dice por qué en vez de dibujar un encabezado solo. */
  isEmpty?: boolean;
  emptyLabel?: string;
};

export function AdminTable({
  columns,
  gridClassName,
  children,
  label,
  isEmpty = false,
  emptyLabel,
}: AdminTableProps) {
  return (
    <div role="group" aria-label={label} className="border-t border-line-subtle">
      <div className="overflow-x-auto">
        <div
          className={`hidden items-center gap-x-3.5 border-b border-line-subtle py-2 text-st-overline font-bold uppercase tracking-wider text-ink-muted md:grid md:min-w-[46rem] ${gridClassName}`}
        >
          {columns.map((column, index) => (
            <div key={`${column}-${index}`}>{column}</div>
          ))}
        </div>

        {isEmpty ? (
          <p className="py-6 text-st-body text-ink-secondary">{emptyLabel}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/**
 * Una fila de la tabla. En móvil se apila; en escritorio respeta las columnas congeladas.
 *
 * `md:min-w-[46rem]` es lo que hace que el **scroll viva en el contenedor de la tabla** y no en la página:
 * a 768 px las columnas congeladas no entran, así que la fila conserva su ancho mínimo y el contenedor la
 * desplaza. Es la regla de la SPEC («`overflow-x` sólo en el contenedor de la tabla, nunca en la página») y
 * la del Viewport Contract.
 */
export function AdminTableRow({
  gridClassName,
  children,
}: {
  gridClassName: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid gap-y-2 border-b border-line-subtle py-3 md:min-w-[46rem] md:items-center md:gap-x-3.5 md:py-2.5 ${gridClassName}`}
    >
      {children}
    </div>
  );
}

/**
 * La celda con su rótulo para el teléfono.
 *
 * En escritorio el rótulo de la columna ya está en el encabezado y no se repite; en móvil, donde el
 * encabezado no se dibuja, cada celda dice a qué columna pertenece. Sin esto, una tarjeta apilada sería una
 * lista de valores sin nombre.
 */
export function AdminTableCell({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="text-st-overline font-bold uppercase tracking-wider text-ink-muted md:hidden">
        {label}
      </span>
      <div className={mono ? "font-mono tabular-nums text-ink" : "text-ink"}>{children}</div>
    </div>
  );
}
