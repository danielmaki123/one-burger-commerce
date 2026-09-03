export type CasaAntiguaTargetTable = {
  label: string;
  locationId: "Barra" | "Terraza";
  capacity: number;
  isActive: true;
  qrToken: string;
};

export type ExistingTableSnapshot = {
  id: string;
  label: string;
  qrToken: string;
  isActive: boolean;
  locationId: string;
  capacity: number;
  reservationsCount: number;
  ordersCount: number;
};

export type TableUpdateAction = {
  id: string;
  label: string;
  patch: Partial<
    Pick<CasaAntiguaTargetTable, "label" | "locationId" | "capacity" | "isActive">
  >;
};

export type CasaAntiguaTableSyncPlan = {
  updates: TableUpdateAction[];
  creates: CasaAntiguaTargetTable[];
  extras: ExistingTableSnapshot[];
  blockingIssues: string[];
  isSafeToApply: boolean;
};

export type PublicTableDisplayShape = {
  label: string;
  capacity: number;
  locationId?: string | null;
};

const TABLE_LABEL_COLLATOR = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function targetTable(
  label: string,
  locationId: "Barra" | "Terraza",
  capacity: number,
  qrToken: string,
): CasaAntiguaTargetTable {
  return {
    label,
    locationId,
    capacity,
    isActive: true,
    qrToken,
  };
}

export const CASA_ANTIGUA_INITIAL_TABLES: CasaAntiguaTargetTable[] = [
  targetTable("Mesa 1", "Barra", 4, "casa-antigua-mesa-01"),
  targetTable("Mesa 2", "Barra", 4, "casa-antigua-mesa-02"),
  targetTable("Mesa 3", "Barra", 4, "casa-antigua-mesa-03"),
  targetTable("Mesa 4", "Barra", 4, "casa-antigua-mesa-04"),
  targetTable("Mesa 5", "Barra", 4, "casa-antigua-mesa-05"),
  targetTable("Mesa 6", "Barra", 4, "casa-antigua-mesa-06"),
  targetTable("Mesa 7", "Barra", 6, "casa-antigua-mesa-07"),
  targetTable("Mesa 8", "Terraza", 8, "casa-antigua-mesa-08"),
  targetTable("Mesa 9", "Terraza", 4, "casa-antigua-mesa-09"),
  targetTable("Mesa 10", "Terraza", 4, "casa-antigua-mesa-10"),
  targetTable("Mesa 11", "Terraza", 4, "casa-antigua-mesa-11"),
  targetTable("Mesa 12", "Terraza", 6, "casa-antigua-mesa-12"),
  targetTable("Mesa 13", "Terraza", 6, "casa-antigua-mesa-13"),
  targetTable("Mesa 14", "Terraza", 6, "casa-antigua-mesa-14"),
  targetTable("Mesa 15", "Terraza", 4, "casa-antigua-mesa-15"),
  targetTable("Mesa 16", "Terraza", 4, "casa-antigua-mesa-16"),
  targetTable("Mesa 17", "Terraza", 4, "casa-antigua-mesa-17"),
  targetTable("Mesa 18", "Terraza", 4, "casa-antigua-mesa-18"),
  targetTable("Mesa 19", "Terraza", 8, "casa-antigua-mesa-19"),
];

function normalizeTableLabelKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function sortTablesNaturally<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((left, right) =>
    TABLE_LABEL_COLLATOR.compare(left.label, right.label),
  );
}

export function formatPublicTableOptionLabel(
  table: PublicTableDisplayShape,
): string {
  const locationLabel = table.locationId?.trim();
  const capacityLabel = `capacidad ${table.capacity} personas`;

  if (!locationLabel) {
    return `${table.label} · ${capacityLabel}`;
  }

  return `${locationLabel} · ${table.label} · ${capacityLabel}`;
}

export function buildCasaAntiguaTableSyncPlan(
  existingTables: ExistingTableSnapshot[],
): CasaAntiguaTableSyncPlan {
  const existingByNormalizedLabel = new Map<string, ExistingTableSnapshot[]>();
  for (const table of existingTables) {
    const key = normalizeTableLabelKey(table.label);
    const grouped = existingByNormalizedLabel.get(key) ?? [];
    grouped.push(table);
    existingByNormalizedLabel.set(key, grouped);
  }

  const blockingIssues: string[] = [];
  const updates: TableUpdateAction[] = [];
  const creates: CasaAntiguaTargetTable[] = [];

  for (const target of CASA_ANTIGUA_INITIAL_TABLES) {
    const key = normalizeTableLabelKey(target.label);
    const matches = existingByNormalizedLabel.get(key) ?? [];

    if (matches.length > 1) {
      blockingIssues.push(
        `Duplicate target labels found in current data: ${target.label}`,
      );
      continue;
    }

    const current = matches[0];
    if (current) {
      const patch: TableUpdateAction["patch"] = {};

      if (current.label !== target.label) patch.label = target.label;
      if (current.locationId !== target.locationId) {
        patch.locationId = target.locationId;
      }
      if (current.capacity !== target.capacity) patch.capacity = target.capacity;
      if (!current.isActive) patch.isActive = true;

      if (Object.keys(patch).length > 0) {
        updates.push({
          id: current.id,
          label: target.label,
          patch,
        });
      }
      continue;
    }

    const qrCollision = existingTables.find(
      (table) => table.qrToken === target.qrToken,
    );
    if (qrCollision) {
      blockingIssues.push(
        `QR token collision for ${target.label}: ${target.qrToken}`,
      );
      continue;
    }

    creates.push(target);
  }

  const targetKeys = new Set(
    CASA_ANTIGUA_INITIAL_TABLES.map((table) => normalizeTableLabelKey(table.label)),
  );
  const extras = sortTablesNaturally(
    existingTables.filter(
      (table) => !targetKeys.has(normalizeTableLabelKey(table.label)),
    ),
  );

  return {
    updates,
    creates,
    extras,
    blockingIssues,
    isSafeToApply: blockingIssues.length === 0,
  };
}
