import * as React from "react";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ className = "", label, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center space-x-3 cursor-pointer">
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className={`peer h-5 w-5 cursor-pointer appearance-none rounded border border-border bg-card transition-all checked:border-brand checked:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
          {...props}
        />
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 text-brand-foreground"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      {label && <span className="text-foreground text-sm font-medium">{label}</span>}
    </label>
  );
}
