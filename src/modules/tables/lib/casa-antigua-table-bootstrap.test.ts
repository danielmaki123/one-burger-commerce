import { describe, expect, it } from "vitest";

import {
  buildCasaAntiguaTableSyncPlan,
  CASA_ANTIGUA_INITIAL_TABLES,
  formatPublicTableOptionLabel,
  sortTablesNaturally,
  type ExistingTableSnapshot,
} from "./casa-antigua-table-bootstrap";

describe("casa antigua table bootstrap", () => {
  it("defines the 19 operational tables for Casa Antigua", () => {
    expect(CASA_ANTIGUA_INITIAL_TABLES).toHaveLength(19);

    const barra = CASA_ANTIGUA_INITIAL_TABLES.filter(
      (table) => table.locationId === "Barra",
    );
    const terraza = CASA_ANTIGUA_INITIAL_TABLES.filter(
      (table) => table.locationId === "Terraza",
    );

    expect(barra.map((table) => table.label)).toEqual([
      "Mesa 1",
      "Mesa 2",
      "Mesa 3",
      "Mesa 4",
      "Mesa 5",
      "Mesa 6",
      "Mesa 7",
    ]);
    expect(terraza.map((table) => table.label)).toEqual([
      "Mesa 8",
      "Mesa 9",
      "Mesa 10",
      "Mesa 11",
      "Mesa 12",
      "Mesa 13",
      "Mesa 14",
      "Mesa 15",
      "Mesa 16",
      "Mesa 17",
      "Mesa 18",
      "Mesa 19",
    ]);
  });

  it("sorts operational labels naturally", () => {
    const sorted = sortTablesNaturally([
      { label: "Mesa 10" },
      { label: "Mesa 2" },
      { label: "Mesa 1" },
      { label: "Mesa 19" },
      { label: "Mesa 11" },
    ]);

    expect(sorted.map((table) => table.label)).toEqual([
      "Mesa 1",
      "Mesa 2",
      "Mesa 10",
      "Mesa 11",
      "Mesa 19",
    ]);
  });

  it("formats public option labels with area, table, and capacity", () => {
    expect(
      formatPublicTableOptionLabel({
        locationId: "Barra",
        label: "Mesa 7",
        capacity: 6,
      }),
    ).toBe("Barra · Mesa 7 · capacidad 6 personas");
  });

  it("updates exact label matches, creates missing targets, and reports extras", () => {
    const existing: ExistingTableSnapshot[] = [
      {
        id: "table_01",
        label: "Mesa 1",
        qrToken: "legacy-mesa-1",
        isActive: false,
        locationId: "main",
        capacity: 2,
        reservationsCount: 1,
        ordersCount: 0,
      },
      {
        id: "table_08",
        label: "Mesa 8",
        qrToken: "legacy-mesa-8",
        isActive: true,
        locationId: "Terraza",
        capacity: 8,
        reservationsCount: 0,
        ordersCount: 1,
      },
      {
        id: "table_extra",
        label: "Barra 1",
        qrToken: "seed-table-04",
        isActive: true,
        locationId: "main",
        capacity: 2,
        reservationsCount: 0,
        ordersCount: 0,
      },
    ];

    const plan = buildCasaAntiguaTableSyncPlan(existing);

    expect(plan.isSafeToApply).toBe(true);
    expect(plan.blockingIssues).toHaveLength(0);
    expect(plan.updates).toEqual([
      {
        id: "table_01",
        label: "Mesa 1",
        patch: {
          isActive: true,
          locationId: "Barra",
          capacity: 4,
        },
      },
    ]);
    expect(plan.creates).toHaveLength(17);
    expect(plan.creates[0]).toMatchObject({
      label: "Mesa 2",
      locationId: "Barra",
      capacity: 4,
      isActive: true,
      qrToken: "casa-antigua-mesa-02",
    });
    expect(plan.extras.map((table) => table.label)).toEqual(["Barra 1"]);
  });

  it("blocks when the current data has duplicate target labels", () => {
    const existing: ExistingTableSnapshot[] = [
      {
        id: "table_a",
        label: "Mesa 7",
        qrToken: "mesa-7-a",
        isActive: true,
        locationId: "Barra",
        capacity: 6,
        reservationsCount: 0,
        ordersCount: 0,
      },
      {
        id: "table_b",
        label: "Mesa 7",
        qrToken: "mesa-7-b",
        isActive: true,
        locationId: "Terraza",
        capacity: 4,
        reservationsCount: 0,
        ordersCount: 0,
      },
    ];

    const plan = buildCasaAntiguaTableSyncPlan(existing);

    expect(plan.isSafeToApply).toBe(false);
    expect(plan.blockingIssues).toContain(
      "Duplicate target labels found in current data: Mesa 7",
    );
  });

  it("blocks when a deterministic QR token for a missing target is already used elsewhere", () => {
    const existing: ExistingTableSnapshot[] = [
      {
        id: "table_extra",
        label: "Barra 1",
        qrToken: "casa-antigua-mesa-19",
        isActive: true,
        locationId: "main",
        capacity: 2,
        reservationsCount: 0,
        ordersCount: 0,
      },
    ];

    const plan = buildCasaAntiguaTableSyncPlan(existing);

    expect(plan.isSafeToApply).toBe(false);
    expect(plan.blockingIssues).toContain(
      "QR token collision for Mesa 19: casa-antigua-mesa-19",
    );
  });
});
