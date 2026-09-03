import * as React from "react";

export function RadioGroup({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
}

export function RadioGroupItem({ 
  value, 
  id, 
  name, 
  checked, 
  onChange, 
  label,
  className = "" 
}: { 
  value: string, 
  id: string, 
  name: string, 
  checked: boolean, 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  label: string,
  className?: string
}) {
  return (
    <label htmlFor={id} className="flex items-center space-x-3 cursor-pointer group">
      <div className="relative flex items-center">
        <input
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className={`peer h-5 w-5 cursor-pointer appearance-none rounded-full border border-border bg-card transition-all checked:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
        />
        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-0 peer-checked:opacity-100 transition-opacity" />
      </div>
      <span className="text-foreground text-sm font-medium transition-colors">{label}</span>
    </label>
  );
}
