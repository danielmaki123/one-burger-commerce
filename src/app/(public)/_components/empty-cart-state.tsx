"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

export function EmptyCartState() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg rounded-[28px] border-border bg-card shadow-[0_24px_60px_rgba(60,40,20,0.1)]">
        <CardContent className="space-y-6 p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-brand">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
          </div>
          <div className="space-y-2.5">
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Tu carrito está vacío
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
              Agregá productos del menú para armar tu pedido.
            </p>
          </div>
          <Button
            className="h-12 w-full rounded-xl text-base font-semibold sm:h-14"
            onClick={() => router.push("/menu")}
          >
            Ver menú
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
