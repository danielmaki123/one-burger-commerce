import * as React from "react";

export function Tabs({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`w-full ${className}`}>{children}</div>;
}

export function TabsList({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex rounded-lg bg-secondary p-1 ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ 
  value, 
  activeValue, 
  onClick, 
  children, 
  className = "" 
}: { 
  value: string, 
  activeValue: string, 
  onClick: (value: string) => void, 
  children: React.ReactNode,
  className?: string
}) {
  const isActive = value === activeValue;
  return (
    <button
      onClick={() => onClick(value)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-brand text-brand-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ 
  value, 
  activeValue, 
  children, 
  className = "" 
}: { 
  value: string, 
  activeValue: string, 
  children: React.ReactNode,
  className?: string
}) {
  if (value !== activeValue) return null;
  return <div className={`mt-4 ${className}`}>{children}</div>;
}
