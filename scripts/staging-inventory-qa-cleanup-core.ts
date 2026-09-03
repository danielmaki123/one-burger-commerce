import { PrismaClient } from "@prisma/client";

const TARGET_IDS = {
  countId: "cmpfpaihv000dpg0jilkl1o1f",
  receiveId: "cmpfpajk5000fpg0jawe9joi6",
  wasteId: "cmpfpak28000hpg0jseg4c1jy",
} as const;

export type RunInventoryQaCleanupResult = {
  status: "ok";
  source: "internal_api";
  precheck: {
    countExists: boolean;
    receiveExists: boolean;
    wasteExists: boolean;
    inventoryItemIds: string[];
  };
  deleted: {
    count: number;
    receive: number;
    waste: number;
  };
  postcheck: {
    countExists: boolean;
    receiveExists: boolean;
    wasteExists: boolean;
  };
};

function assertStagingEnvironment() {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("STAGING_ONLY_OPERATION");
  }
}

export async function runStagingInventoryQaCleanup(): Promise<RunInventoryQaCleanupResult> {
  assertStagingEnvironment();
  const prisma = new PrismaClient();

  try {
    const countBefore = await prisma.inventoryCount.findUnique({
      where: { id: TARGET_IDS.countId },
      select: { id: true, inventoryItemId: true },
    });
    const receiveBefore = await prisma.inventoryReceiveRecord.findUnique({
      where: { id: TARGET_IDS.receiveId },
      select: { id: true, inventoryItemId: true },
    });
    const wasteBefore = await prisma.inventoryWasteRecord.findUnique({
      where: { id: TARGET_IDS.wasteId },
      select: { id: true, inventoryItemId: true },
    });

    const inventoryItemIds = Array.from(
      new Set(
        [countBefore?.inventoryItemId, receiveBefore?.inventoryItemId, wasteBefore?.inventoryItemId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );

    let deletedCount = 0;
    let deletedReceive = 0;
    let deletedWaste = 0;

    if (countBefore) {
      await prisma.inventoryCount.delete({ where: { id: TARGET_IDS.countId } });
      deletedCount = 1;
    }
    if (receiveBefore) {
      await prisma.inventoryReceiveRecord.delete({ where: { id: TARGET_IDS.receiveId } });
      deletedReceive = 1;
    }
    if (wasteBefore) {
      await prisma.inventoryWasteRecord.delete({ where: { id: TARGET_IDS.wasteId } });
      deletedWaste = 1;
    }

    const countAfter = await prisma.inventoryCount.findUnique({
      where: { id: TARGET_IDS.countId },
      select: { id: true },
    });
    const receiveAfter = await prisma.inventoryReceiveRecord.findUnique({
      where: { id: TARGET_IDS.receiveId },
      select: { id: true },
    });
    const wasteAfter = await prisma.inventoryWasteRecord.findUnique({
      where: { id: TARGET_IDS.wasteId },
      select: { id: true },
    });

    return {
      status: "ok",
      source: "internal_api",
      precheck: {
        countExists: Boolean(countBefore),
        receiveExists: Boolean(receiveBefore),
        wasteExists: Boolean(wasteBefore),
        inventoryItemIds,
      },
      deleted: {
        count: deletedCount,
        receive: deletedReceive,
        waste: deletedWaste,
      },
      postcheck: {
        countExists: Boolean(countAfter),
        receiveExists: Boolean(receiveAfter),
        wasteExists: Boolean(wasteAfter),
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}
