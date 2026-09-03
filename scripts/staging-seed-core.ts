import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/shared/lib/auth/password-hasher";
import { ADMIN_ROLES, type AdminRole } from "../src/modules/auth/domain/admin-role";
import type { ReservationStatus } from "../src/modules/reservations/domain/reservation.types";

const STG_PREFIX = "STG-";

export type StagingSeedOptions = {
  dryRun: boolean;
  source: "cli" | "internal_api";
};

export type StagingSeedCleanupOptions = {
  source: "cli" | "internal_api";
};

function assertStagingEnvironment() {
  const appEnv = process.env.APP_ENV;
  if (appEnv !== "staging") {
    throw new Error(
      `Operacion abortada: APP_ENV debe ser 'staging' (actual: '${appEnv ?? "undefined"}').`,
    );
  }
}

function assertSeedConfirmFlag() {
  if (process.env.STAGING_SEED_CONFIRM !== "true") {
    throw new Error(
      "Operacion abortada: STAGING_SEED_CONFIRM=true es obligatorio.",
    );
  }
}

function assertCleanupConfirmFlag() {
  if (process.env.STAGING_SEED_CLEANUP_CONFIRM !== "true") {
    throw new Error(
      "Operacion abortada: STAGING_SEED_CLEANUP_CONFIRM=true es obligatorio.",
    );
  }
}

type RuntimeContext = {
  prisma: PrismaClient;
  dryRun: boolean;
  systemUserId: string;
};

async function ensureAdminUsers(ctx: RuntimeContext) {
  const createAdmin = process.env.STAGING_SEED_CREATE_ADMIN === "true";
  const createStaff = process.env.STAGING_SEED_CREATE_STAFF === "true";

  if (!createAdmin && !createStaff) {
    return { adminEnabled: false, staffEnabled: false };
  }

  async function upsertUser(role: AdminRole, label: "ADMIN" | "STAFF") {
    const email = process.env[`STAGING_${label}_EMAIL`];
    const password = process.env[`STAGING_${label}_PASSWORD`];
    const name =
      process.env[`STAGING_${label}_NAME`] ??
      `${STG_PREFIX}${label === "ADMIN" ? "Admin" : "Inventory Staff"}`;

    if (!email || !password) {
      throw new Error(
        `Seed abortado: faltan STAGING_${label}_EMAIL/STAGING_${label}_PASSWORD.`,
      );
    }

    if (ctx.dryRun) return;

    await ctx.prisma.adminUser.upsert({
      where: { email: email.trim().toLowerCase() },
      update: {
        name,
        role,
        passwordHash: hashPassword(password),
      },
      create: {
        name,
        email: email.trim().toLowerCase(),
        role,
        passwordHash: hashPassword(password),
      },
    });
  }

  if (createAdmin) await upsertUser(ADMIN_ROLES.owner, "ADMIN");
  if (createStaff) await upsertUser(ADMIN_ROLES.manager, "STAFF");

  return { adminEnabled: createAdmin, staffEnabled: createStaff };
}

async function ensureMenu(ctx: RuntimeContext) {
  const categories = [
    { key: "bebidas", name: `${STG_PREFIX}Menu-Bebidas`, sortOrder: 10 },
    { key: "comidas", name: `${STG_PREFIX}Menu-Comidas`, sortOrder: 20 },
  ] as const;

  const subcategories = [
    {
      key: "cafes",
      name: `${STG_PREFIX}Sub-Cafes`,
      sortOrder: 10,
      categoryKey: "bebidas",
    },
    {
      key: "entradas",
      name: `${STG_PREFIX}Sub-Entradas`,
      sortOrder: 10,
      categoryKey: "comidas",
    },
  ] as const;

  const products = [
    {
      name: `${STG_PREFIX}Prod-Americano`,
      description: "Cafe americano de prueba staging",
      basePrice: "2.50",
      categoryKey: "bebidas",
      subcategoryKey: "cafes",
      isAvailable: true,
      sortOrder: 10,
    },
    {
      name: `${STG_PREFIX}Prod-Latte`,
      description: "Latte de prueba staging",
      basePrice: "3.50",
      categoryKey: "bebidas",
      subcategoryKey: "cafes",
      isAvailable: true,
      sortOrder: 20,
    },
    {
      name: `${STG_PREFIX}Prod-YucaFrita`,
      description: "Yuca frita de prueba staging",
      basePrice: "4.25",
      categoryKey: "comidas",
      subcategoryKey: "entradas",
      isAvailable: true,
      sortOrder: 10,
    },
    {
      name: `${STG_PREFIX}Prod-TablaMixta`,
      description: "Tabla mixta de prueba staging",
      basePrice: "8.75",
      categoryKey: "comidas",
      subcategoryKey: "entradas",
      isAvailable: false,
      sortOrder: 20,
    },
  ] as const;

  if (ctx.dryRun) {
    return {
      categories: categories.length,
      subcategories: subcategories.length,
      products: products.length,
      images: products.length,
    };
  }

  const categoryMap = new Map<string, { id: string }>();
  for (const item of categories) {
    const category = await ctx.prisma.category.upsert({
      where: { slug: `stg-menu-${item.key}` },
      update: {
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        name: item.name,
        slug: `stg-menu-${item.key}`,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      select: { id: true },
    });
    categoryMap.set(item.key, category);
  }

  const subcategoryMap = new Map<string, { id: string }>();
  for (const item of subcategories) {
    const category = categoryMap.get(item.categoryKey);
    if (!category) throw new Error(`Categoria faltante para ${item.key}`);

    const sub = await ctx.prisma.subcategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: category.id,
          slug: `stg-sub-${item.key}`,
        },
      },
      update: {
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        categoryId: category.id,
        name: item.name,
        slug: `stg-sub-${item.key}`,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      select: { id: true },
    });
    subcategoryMap.set(item.key, sub);
  }

  for (const item of products) {
    const category = categoryMap.get(item.categoryKey);
    const subcategory = subcategoryMap.get(item.subcategoryKey);
    if (!category || !subcategory) {
      throw new Error(`Categoria/subcategoria faltante para ${item.name}`);
    }

    const existingProduct = await ctx.prisma.product.findFirst({
      where: { name: item.name },
      select: { id: true },
    });

    const product = existingProduct
      ? await ctx.prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            categoryId: category.id,
            subcategoryId: subcategory.id,
            description: item.description,
            basePrice: item.basePrice,
            isAvailable: item.isAvailable,
            isActive: true,
            sortOrder: item.sortOrder,
          },
          select: { id: true },
        })
      : await ctx.prisma.product.create({
          data: {
            categoryId: category.id,
            subcategoryId: subcategory.id,
            name: item.name,
            description: item.description,
            basePrice: item.basePrice,
            isAvailable: item.isAvailable,
            isActive: true,
            sortOrder: item.sortOrder,
          },
          select: { id: true },
        });

    const imageSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const imageUrl = `https://example.invalid/staging/${imageSlug}.jpg`;
    const existingImage = await ctx.prisma.productImage.findFirst({
      where: { productId: product.id, alt: `${item.name} image` },
      select: { id: true },
    });

    if (existingImage) {
      await ctx.prisma.productImage.update({
        where: { id: existingImage.id },
        data: { url: imageUrl, sortOrder: 0, isPrimary: true },
      });
    } else {
      await ctx.prisma.productImage.create({
        data: {
          productId: product.id,
          url: imageUrl,
          alt: `${item.name} image`,
          sortOrder: 0,
          isPrimary: true,
        },
      });
    }
  }

  return {
    categories: categories.length,
    subcategories: subcategories.length,
    products: products.length,
    images: products.length,
  };
}

async function ensureTablesAndReservations(ctx: RuntimeContext) {
  const tables = [
    { label: `${STG_PREFIX}TBL-01`, qrToken: "stg-tbl-01", capacity: 2 },
    { label: `${STG_PREFIX}TBL-02`, qrToken: "stg-tbl-02", capacity: 4 },
    { label: `${STG_PREFIX}TBL-03`, qrToken: "stg-tbl-03", capacity: 6 },
  ] as const;

  const reservations = [
    {
      key: "requested",
      status: "requested" as ReservationStatus,
      tableQr: "stg-tbl-01",
      date: "2099-01-10",
      time: "18:00",
      partySize: 2,
    },
    {
      key: "approved",
      status: "approved" as ReservationStatus,
      tableQr: "stg-tbl-02",
      date: "2099-01-10",
      time: "19:00",
      partySize: 4,
    },
    {
      key: "seated",
      status: "seated" as ReservationStatus,
      tableQr: "stg-tbl-03",
      date: "2099-01-10",
      time: "20:00",
      partySize: 6,
    },
  ] as const;

  if (ctx.dryRun) {
    return {
      tables: tables.length,
      reservations: reservations.length,
    };
  }

  const tableMap = new Map<string, { id: string; label: string }>();
  for (const table of tables) {
    const saved = await ctx.prisma.table.upsert({
      where: { qrToken: table.qrToken },
      update: { label: table.label, capacity: table.capacity, isActive: true },
      create: {
        label: table.label,
        qrToken: table.qrToken,
        capacity: table.capacity,
        isActive: true,
      },
      select: { id: true, label: true },
    });
    tableMap.set(table.qrToken, saved);
  }

  for (const reservation of reservations) {
    const table = tableMap.get(reservation.tableQr);
    if (!table) throw new Error(`Mesa faltante para ${reservation.key}`);

    const existing = await ctx.prisma.reservation.findFirst({
      where: {
        customerName: `${STG_PREFIX}RES-${reservation.key}`,
        date: reservation.date,
        time: reservation.time,
      },
      select: { id: true },
    });

    if (existing) {
      await ctx.prisma.reservation.update({
        where: { id: existing.id },
        data: {
          status: reservation.status,
          tableId: table.id,
          tableLabel: table.label,
          partySize: reservation.partySize,
          notes: `${STG_PREFIX} reservation seed`,
        },
      });
    } else {
      await ctx.prisma.reservation.create({
        data: {
          status: reservation.status,
          customerName: `${STG_PREFIX}RES-${reservation.key}`,
          customerWhatsapp: "0000000000",
          date: reservation.date,
          time: reservation.time,
          partySize: reservation.partySize,
          tableId: table.id,
          tableLabel: table.label,
          notes: `${STG_PREFIX} reservation seed`,
        },
      });
    }
  }

  return {
    tables: tables.length,
    reservations: reservations.length,
  };
}

async function ensureInventory(ctx: RuntimeContext) {
  const items = [
    {
      key: "cafe-molido",
      name: `${STG_PREFIX}INV-CafeMolido`,
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: "10.000",
      lowStockThreshold: "3.000",
    },
    {
      key: "leche",
      name: `${STG_PREFIX}INV-Leche`,
      unit: "lt",
      category: "refrigerados",
      currentEstimatedStock: "4.000",
      lowStockThreshold: "2.000",
    },
    {
      key: "yuca",
      name: `${STG_PREFIX}INV-Yuca`,
      unit: "kg",
      category: "frescos",
      currentEstimatedStock: "1.500",
      lowStockThreshold: "2.000",
    },
    {
      key: "aceite",
      name: `${STG_PREFIX}INV-Aceite`,
      unit: "lt",
      category: "insumos",
      currentEstimatedStock: "6.000",
      lowStockThreshold: "1.000",
    },
  ] as const;

  if (ctx.dryRun) {
    return {
      items: items.length,
      counts: items.length,
      receives: 2,
      wastes: 1,
    };
  }

  const itemMap = new Map<string, { id: string }>();
  for (const item of items) {
    const existing = await ctx.prisma.inventoryItem.findFirst({
      where: { name: item.name },
      select: { id: true },
    });
    const saved = existing
      ? await ctx.prisma.inventoryItem.update({
          where: { id: existing.id },
          data: {
            unit: item.unit,
            category: item.category,
            currentEstimatedStock: item.currentEstimatedStock,
            lowStockThreshold: item.lowStockThreshold,
            isActive: true,
          },
          select: { id: true },
        })
      : await ctx.prisma.inventoryItem.create({
          data: {
            name: item.name,
            unit: item.unit,
            category: item.category,
            currentEstimatedStock: item.currentEstimatedStock,
            lowStockThreshold: item.lowStockThreshold,
            isActive: true,
          },
          select: { id: true },
        });
    itemMap.set(item.key, saved);
  }

  async function ensureCount(itemKey: string, quantity: string) {
    const item = itemMap.get(itemKey);
    if (!item) return;
    const note = `${STG_PREFIX} seed count`;
    const found = await ctx.prisma.inventoryCount.findFirst({
      where: { inventoryItemId: item.id, notes: note },
      select: { id: true },
    });
    if (!found) {
      await ctx.prisma.inventoryCount.create({
        data: {
          inventoryItemId: item.id,
          countedQuantity: quantity,
          countedByUserId: ctx.systemUserId,
          notes: note,
        },
      });
    }
  }

  async function ensureReceive(itemKey: string, quantity: string) {
    const item = itemMap.get(itemKey);
    if (!item) return;
    const note = `${STG_PREFIX} seed receive`;
    const found = await ctx.prisma.inventoryReceiveRecord.findFirst({
      where: { inventoryItemId: item.id, notes: note },
      select: { id: true },
    });
    if (!found) {
      await ctx.prisma.inventoryReceiveRecord.create({
        data: {
          inventoryItemId: item.id,
          receivedQuantity: quantity,
          receivedByUserId: ctx.systemUserId,
          notes: note,
        },
      });
    }
  }

  async function ensureWaste(itemKey: string, quantity: string, reason: string) {
    const item = itemMap.get(itemKey);
    if (!item) return;
    const note = `${STG_PREFIX} seed waste`;
    const found = await ctx.prisma.inventoryWasteRecord.findFirst({
      where: { inventoryItemId: item.id, notes: note },
      select: { id: true },
    });
    if (!found) {
      await ctx.prisma.inventoryWasteRecord.create({
        data: {
          inventoryItemId: item.id,
          quantity,
          reason,
          reportedByUserId: ctx.systemUserId,
          notes: note,
        },
      });
    }
  }

  await ensureCount("cafe-molido", "9.000");
  await ensureCount("leche", "4.000");
  await ensureCount("yuca", "1.500");
  await ensureCount("aceite", "6.000");
  await ensureReceive("cafe-molido", "3.000");
  await ensureReceive("leche", "2.000");
  await ensureWaste("yuca", "0.500", `${STG_PREFIX}WASTE-DEMO`);

  return {
    items: items.length,
    counts: items.length,
    receives: 2,
    wastes: 1,
  };
}

async function getCurrentSummary(prisma: PrismaClient) {
  const [categories, subcategories, products, tables, inventoryItems, reservations] =
    await Promise.all([
      prisma.category.count({ where: { name: { startsWith: STG_PREFIX } } }),
      prisma.subcategory.count({ where: { name: { startsWith: STG_PREFIX } } }),
      prisma.product.count({ where: { name: { startsWith: STG_PREFIX } } }),
      prisma.table.count({ where: { label: { startsWith: STG_PREFIX } } }),
      prisma.inventoryItem.count({
        where: { name: { startsWith: `${STG_PREFIX}INV-` } },
      }),
      prisma.reservation.count({
        where: { customerName: { startsWith: `${STG_PREFIX}RES-` } },
      }),
    ]);

  return { categories, subcategories, products, tables, inventoryItems, reservations };
}

export async function runStagingSeed(options: StagingSeedOptions) {
  assertStagingEnvironment();
  assertSeedConfirmFlag();

  const prisma = new PrismaClient();
  const ctx: RuntimeContext = {
    prisma,
    dryRun: options.dryRun,
    systemUserId: process.env.STAGING_SEED_SYSTEM_USER_ID ?? "stg-system-user",
  };

  const plan = {
    menu: {
      categories: ["STG-Menu-Bebidas", "STG-Menu-Comidas"],
      subcategories: ["STG-Sub-Cafes", "STG-Sub-Entradas"],
      products: [
        "STG-Prod-Americano",
        "STG-Prod-Latte",
        "STG-Prod-YucaFrita",
        "STG-Prod-TablaMixta",
      ],
    },
    reservations: {
      tables: ["STG-TBL-01", "STG-TBL-02", "STG-TBL-03"],
      reservationStatuses: ["requested", "approved", "seated"],
    },
    inventory: {
      items: [
        "STG-INV-CafeMolido",
        "STG-INV-Leche",
        "STG-INV-Yuca",
        "STG-INV-Aceite",
      ],
      movements: ["count", "receive", "waste"],
    },
    auth: {
      optionalAdmin: process.env.STAGING_SEED_CREATE_ADMIN === "true",
      optionalStaff: process.env.STAGING_SEED_CREATE_STAFF === "true",
    },
  };

  try {
    const admin = await ensureAdminUsers(ctx);
    const menu = await ensureMenu(ctx);
    const reservations = await ensureTablesAndReservations(ctx);
    const inventory = await ensureInventory(ctx);

    const current =
      options.dryRun === true ? null : await getCurrentSummary(prisma);

    return {
      status: "ok" as const,
      source: options.source,
      dryRun: options.dryRun,
      plan,
      simulatedOrApplied: { admin, menu, reservations, inventory },
      current,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function runStagingSeedCleanup(options: StagingSeedCleanupOptions) {
  assertStagingEnvironment();
  assertCleanupConfirmFlag();

  const prisma = new PrismaClient();
  try {
    const tables = await prisma.table.findMany({
      where: { label: { startsWith: STG_PREFIX } },
      select: { id: true },
    });
    const tableIds = tables.map((t: { id: string }) => t.id);

    const reservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { customerName: { startsWith: `${STG_PREFIX}RES-` } },
          { tableId: { in: tableIds } },
        ],
      },
      select: { id: true },
    });
    const reservationIds = reservations.map((r: { id: string }) => r.id);

    if (reservationIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    }
    if (tableIds.length > 0) {
      await prisma.table.deleteMany({ where: { id: { in: tableIds } } });
    }

    const products = await prisma.product.findMany({
      where: { name: { startsWith: STG_PREFIX } },
      select: { id: true },
    });
    const productIds = products.map((p: { id: string }) => p.id);
    if (productIds.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }

    await prisma.subcategory.deleteMany({
      where: { name: { startsWith: STG_PREFIX } },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: STG_PREFIX } },
    });

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { name: { startsWith: `${STG_PREFIX}INV-` } },
      select: { id: true },
    });
    const itemIds = inventoryItems.map((i: { id: string }) => i.id);
    if (itemIds.length > 0) {
      await prisma.inventoryWasteRecord.deleteMany({
        where: { inventoryItemId: { in: itemIds } },
      });
      await prisma.inventoryReceiveRecord.deleteMany({
        where: { inventoryItemId: { in: itemIds } },
      });
      await prisma.inventoryCount.deleteMany({
        where: { inventoryItemId: { in: itemIds } },
      });
      await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    }

    return {
      status: "ok" as const,
      source: options.source,
      removed: {
        reservations: reservationIds.length,
        tables: tableIds.length,
        products: productIds.length,
        inventoryItems: itemIds.length,
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}
