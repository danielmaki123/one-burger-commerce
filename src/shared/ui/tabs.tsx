import * as React from "react";

export function Tabs({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`w-full ${className}`}>{children}</div>;
}

export function TabsList({
  children,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={`flex gap-1 rounded-stitch-md bg-surface-input p-1 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Segmentado del panel (período, canal, filtros de la tabla).
 *
 * Es un grupo de botones con `aria-pressed`, no un tablist de ARIA: cada disparador **hace** algo al
 * elegirse (recarga datos) y el estado activo tiene que poder leerse sin color. El borde de control y
 * los 44 px son del sistema, y el activo va en el tinte sky del panel (ámbar es identidad y cocina).
 */
export function TabsTrigger({
  value,
  activeValue,
  onClick,
  children,
  className = "",
  ariaLabel,
  testId,
  disabled = false,
}: {
  value: string;
  activeValue: string;
  onClick: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  /**
   * Anclaje estable para un disparador cuando la misma pantalla tiene dos juegos de tabs y el nombre
   * accesible se repite (el modo cocina y el filtro del panel, Punto 3 del roadmap). Los tests y el
   * E2E necesitan decir **cuál** de los dos.
   */
  testId?: string;
  disabled?: boolean;
}) {
  const isActive = value === activeValue;

  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      onClick={() => onClick(value)}
      className={[
        "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-stitch-sm px-3 text-st-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 focus-visible:ring-offset-canvas motion-reduce:transition-none disabled:opacity-60",
        isActive
          ? "bg-brand-primary-muted text-brand-primary"
          : "text-ink-secondary hover:bg-surface-elevated hover:text-brand-primary",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  activeValue,
  children,
  className = "",
}: {
  value: string;
  activeValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (value !== activeValue) return null;
  return <div className={`mt-4 ${className}`}>{children}</div>;
}
