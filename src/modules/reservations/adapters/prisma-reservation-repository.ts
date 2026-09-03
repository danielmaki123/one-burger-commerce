import { getPrismaClient } from "@/infrastructure/database/prisma";
import type {
  ReservationRecord,
  ReservationStatus,
} from "@/modules/reservations/domain/reservation.types";
import type {
  CreateReservationInput,
  ListReservationsFilter,
  ReservationTrackingRecord,
  ReservationRepository,
  TableWithCapacity,
} from "@/modules/reservations/ports/reservation-repository";
import { sortTablesNaturally } from "@/modules/tables/lib/casa-antigua-table-bootstrap";

function mapReservation(r: {
  id: string;
  status: ReservationStatus;
  customerName: string;
  customerWhatsapp: string;
  customerId: string | null;
  reservationNumber: string | null;
  date: string;
  time: string;
  partySize: number;
  tableId: string;
  tableLabel: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ReservationRecord {
  return {
    id: r.id,
    status: r.status as ReservationRecord["status"],
    customerName: r.customerName,
    customerWhatsapp: r.customerWhatsapp,
    customerId: r.customerId,
    reservationNumber: r.reservationNumber,
    date: r.date,
    time: r.time,
    partySize: r.partySize,
    tableId: r.tableId,
    tableLabel: r.tableLabel,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export class PrismaReservationRepository implements ReservationRepository {
  async listTables(): Promise<TableWithCapacity[]> {
    const prisma = getPrismaClient();
    const tables = await prisma.table.findMany({
      orderBy: { label: "asc" },
    });
    return sortTablesNaturally(
      tables.map((t: {
        id: string;
        label: string;
        capacity: number;
        isActive: boolean;
        locationId: string;
      }) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        isActive: t.isActive,
        locationId: t.locationId,
      })),
    );
  }

  async findTableById(id: string): Promise<TableWithCapacity | null> {
    const prisma = getPrismaClient();
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) return null;
    return {
      id: table.id,
      label: table.label,
      capacity: table.capacity,
      isActive: table.isActive,
      locationId: table.locationId,
    };
  }

  async listReservations(
    filter: ListReservationsFilter,
  ): Promise<ReservationRecord[]> {
    const prisma = getPrismaClient();
    const where: { status?: ReservationStatus; date?: string } = {};
    if (filter.status) {
      where.status = filter.status as ReservationStatus;
    }
    if (filter.date) {
      where.date = filter.date;
    }
    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return reservations.map(mapReservation);
  }

  async findReservationById(id: string): Promise<ReservationRecord | null> {
    const prisma = getPrismaClient();
    const r = await prisma.reservation.findUnique({ where: { id } });
    return r ? mapReservation(r) : null;
  }

  async findReservationByNumber(
    reservationNumber: string,
  ): Promise<ReservationRecord | null> {
    const prisma = getPrismaClient();
    const r = await prisma.reservation.findUnique({
      where: { reservationNumber },
    });
    return r ? mapReservation(r) : null;
  }

  async findReservationTrackingByNumber(
    reservationNumber: string,
  ): Promise<ReservationTrackingRecord | null> {
    const prisma = getPrismaClient();
    const reservation = await prisma.reservation.findUnique({
      where: { reservationNumber },
      select: {
        reservationNumber: true,
        reservationLookupTokenHash: true,
        status: true,
        date: true,
        time: true,
        partySize: true,
        tableLabel: true,
        updatedAt: true,
      },
    });

    if (
      !reservation?.reservationNumber ||
      !reservation.reservationLookupTokenHash
    ) {
      return null;
    }

    return {
      reservationNumber: reservation.reservationNumber,
      reservationLookupTokenHash: reservation.reservationLookupTokenHash,
      status: reservation.status,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      tableLabel: reservation.tableLabel,
      updatedAt: reservation.updatedAt.toISOString(),
    };
  }

  async findReservationsByTableAndDate(
    tableId: string,
    date: string,
  ): Promise<ReservationRecord[]> {
    const prisma = getPrismaClient();
    const reservations = await prisma.reservation.findMany({
      where: { tableId, date },
    });
    return reservations.map(mapReservation);
  }

  async createReservation(
    input: CreateReservationInput,
  ): Promise<ReservationRecord> {
    const prisma = getPrismaClient();
    const r = await prisma.reservation.create({
      data: {
        customerName: input.customerName,
        customerWhatsapp: input.customerWhatsapp,
        customerId: input.customerId ?? null,
        reservationNumber: input.reservationNumber ?? null,
        reservationLookupTokenHash: input.reservationLookupTokenHash ?? null,
        date: input.date,
        time: input.time,
        partySize: input.partySize,
        tableId: input.tableId,
        tableLabel: input.tableLabel,
        notes: input.notes ?? null,
        status: "requested",
      },
    });
    return mapReservation(r);
  }

  async updateReservationStatus(
    id: string,
    status: string,
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    const prisma = getPrismaClient();
    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: status as ReservationStatus },
    });
    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
