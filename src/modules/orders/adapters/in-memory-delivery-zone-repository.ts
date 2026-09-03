import type { DeliveryZoneRecord } from "@/modules/orders/domain/order.types";
import type {
  CreateDeliveryZoneInput,
  DeliveryZoneRepository,
  UpdateDeliveryZoneInput,
} from "@/modules/orders/ports/delivery-zone-repository";

export class InMemoryDeliveryZoneRepository implements DeliveryZoneRepository {
  zones: DeliveryZoneRecord[] = [];

  private nextId() {
    return `dz_${this.zones.length + 1}`;
  }

  async listDeliveryZones(): Promise<DeliveryZoneRecord[]> {
    return [...this.zones].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getDeliveryZoneById(id: string): Promise<DeliveryZoneRecord | null> {
    return this.zones.find((z) => z.id === id) ?? null;
  }

  async findDeliveryZoneByNameCaseInsensitive(name: string): Promise<DeliveryZoneRecord | null> {
    const normalized = name.trim().toLowerCase();
    return this.zones.find((z) => z.name.toLowerCase() === normalized) ?? null;
  }

  async createDeliveryZone(input: CreateDeliveryZoneInput): Promise<DeliveryZoneRecord> {
    const now = new Date().toISOString();
    const zone: DeliveryZoneRecord = {
      id: this.nextId(),
      name: input.name.trim(),
      description: input.description ?? null,
      baseFee: input.baseFee,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.zones.push(zone);
    return zone;
  }

  async updateDeliveryZone(id: string, input: UpdateDeliveryZoneInput): Promise<DeliveryZoneRecord> {
    const zone = this.zones.find((z) => z.id === id);
    if (!zone) throw new Error("Delivery zone not found");

    if (input.name !== undefined) zone.name = input.name.trim();
    if (input.description !== undefined) zone.description = input.description ?? null;
    if (input.baseFee !== undefined) zone.baseFee = input.baseFee;
    if (input.isActive !== undefined) zone.isActive = input.isActive;
    if (input.sortOrder !== undefined) zone.sortOrder = input.sortOrder;
    zone.updatedAt = new Date().toISOString();

    return zone;
  }
}
