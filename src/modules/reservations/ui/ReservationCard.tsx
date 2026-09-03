"use client";

import { Calendar, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { ReservationRecord, ReservationStatus } from "../domain/reservation.types";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import Link from "next/link";

interface ReservationCardProps {
  reservation: ReservationRecord;
  isAdmin?: boolean;
}

const statusConfig: Record<ReservationStatus, { label: string; variant: "default" | "secondary" | "danger" | "outline" | "success" | "warning" }> = {
  requested: { label: "Pendiente", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "danger" },
  seated: { label: "En mesa", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "danger" },
  no_show: { label: "No asistió", variant: "danger" },
};

export function ReservationCard({ reservation, isAdmin }: ReservationCardProps) {
  const config = statusConfig[reservation.status];

  return (
    <Link href={isAdmin ? `/admin/reservations/${reservation.id}` : "#"}>
      <Card className="transition-colors hover:border-brand/30 hover:bg-accent/40">
        <CardContent className="p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                {reservation.customerName}
              </h3>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                {reservation.partySize} personas
              </p>
            </div>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{reservation.date}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{reservation.time}</span>
            </div>
            <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{reservation.tableLabel}</span>
            </div>
          </div>

          {isAdmin && (
            <div className="mt-3 flex items-center justify-end border-t border-border pt-3 text-sm font-medium text-brand">
              Ver detalles
              <ChevronRight className="ml-1 h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
