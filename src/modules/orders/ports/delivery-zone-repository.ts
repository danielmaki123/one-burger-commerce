import type { DeliveryZoneRecord } from "@/modules/orders/domain/order.types";

export type CreateDeliveryZoneInput = {
  name: string;
  description?: string | null;
  baseFee: number;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateDeliveryZoneInput = {
  name?: string;
  description?: string | null;
  baseFee?: number;
  isActive?: boolean;
  sortOrder?: number;
};

export interface DeliveryZoneRepository {
  listDeliveryZones(): Promise<DeliveryZoneRecord[]>;
  getDeliveryZoneById(id: string): Promise<DeliveryZoneRecord | null>;
  findDeliveryZoneByNameCaseInsensitive(name: string): Promise<DeliveryZoneRecord | null>;
  createDeliveryZone(input: CreateDeliveryZoneInput): Promise<DeliveryZoneRecord>;
  updateDeliveryZone(id: string, input: UpdateDeliveryZoneInput): Promise<DeliveryZoneRecord>;
}
