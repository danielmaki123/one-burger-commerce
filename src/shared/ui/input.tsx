import * as React from "react";

import { HelpText } from "./help-text";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Texto de ayuda del campo; se anuncia junto con el error (`aria-describedby`). */
  description?: string;
}

export function Input({ className = "", label, error, description, id, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  const describedBy = [description ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none text-foreground"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`flex h-11 w-full rounded-md border border-line-control bg-surface-input px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
      {description && <HelpText id={inputId}>{description}</HelpText>}
      {error && (
        // `role="alert"`: un error de campo tiene que anunciarse, no solo verse.
        <p id={errorId} role="alert" className="text-xs font-medium text-status-sla-text">
          {error}
        </p>
      )}
    </div>
  );
}
