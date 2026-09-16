import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon" | "pill";
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  // El radio vive en cada tamaño y no en la base: `rounded-md` y `rounded-full` son la misma
  // propiedad y en el CSS de Tailwind `rounded-md` se emite **después** de `rounded-full`, así que un
  // `className="rounded-full"` desde afuera pierde la cascada. Por eso el chip tiene su tamaño.
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    primary: "bg-brand text-brand-foreground hover:bg-brand-strong",
    secondary: "bg-secondary text-secondary-foreground hover:brightness-95",
    outline: "border border-border bg-transparent text-foreground hover:bg-cream",
    ghost: "text-muted-foreground hover:bg-cream hover:text-foreground",
    // El peligro sale del sistema Stitch (`--status-sla-pulse`, el rojo de la alerta SLA) en vez del
    // `red-600` crudo: es el mismo tono con nombre, y en el panel oscuro queda medido.
    danger: "bg-status-sla-pulse text-white hover:brightness-95",
  };

  const sizes = {
    sm: "h-8 rounded-md px-3 text-xs",
    md: "h-10 rounded-md px-4 py-2",
    lg: "h-12 rounded-md px-6 text-lg",
    icon: "h-10 w-10 rounded-md",
    /** Chip de filtro (TASK-206): pastilla con el mínimo táctil de 44 px. */
    pill: "min-h-11 rounded-full px-4 text-sm",
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return <button className={combinedClassName} {...props} />;
}
