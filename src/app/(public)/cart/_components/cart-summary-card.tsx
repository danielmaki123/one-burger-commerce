"use client";

import { useRouter } from "next/navigation";

import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { publicCartScaleClasses } from "../cart-scale-helpers";

export function CartSummaryCard({
  subtotal,
  packagingAmount,
}: {
  subtotal: number;
  packagingAmount: number;
}) {
  const router = useRouter();

  return (
    <Card className={publicCartScaleClasses.summaryCard}>
      <CardContent className="space-y-4 p-5">
        <p
          className="text-[16px] font-semibold text-ink-green"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Tu bolsa
        </p>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Empaque</span>
            <span className="font-medium text-foreground">
              {formatCurrency(packagingAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Envío</span>
            <span className="font-medium text-foreground">Se calcula en checkout</span>
          </div>
          <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total estimado
            </p>
            <p className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
              {formatCurrency(subtotal + packagingAmount)}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <Button
            className={publicCartScaleClasses.summaryPrimaryCta}
            onClick={() => router.push("/checkout")}
          >
            Continuar
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full rounded-xl text-sm font-medium"
            onClick={() => router.push("/menu")}
          >
            Seguir viendo menú
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
