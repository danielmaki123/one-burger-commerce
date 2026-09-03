export type DashboardSummary = {
  ordersToday: number;
  ordersPending: number;
  reservationsToday: number;
  reservationsPendingAction: number;
  inventoryCriticalAlerts: number;
  recentActivityCount: number;
};

export type ActivityItem = {
  type: "order" | "reservation" | "inventory";
  id: string;
  description: string;
  occurredAt: string;
};

export type DailyReport = {
  orders: {
    totalCount: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  };
  reservations: {
    totalCount: number;
    byStatus: Record<string, number>;
  };
};

export type InventoryReport = {
  movements: {
    counts: number;
    receives: number;
    wastes: number;
    total: number;
  };
  items: Array<{
    itemId: string;
    itemName: string;
    netChange: number;
  }>;
};
