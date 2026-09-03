import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ids = {
  menu: {
    imageId: "cmpc5g1m60005ob0jcxytm5kq",
    productId: "cmpc5g1m60004ob0jjvt10oai",
    subcategoryId: "cmpc5ela70002ob0j6yrtjjtg",
    categoryId: "cmpc5ecik0000ob0jy42e3efy",
  },
  reservations: {
    tableId: "2d072c2a-a929-4b5b-b1d3-47d22aafedf6",
    reservationIds: ["cmpc5rcep0007ob0ji16fh0x0", "cmpc6xlpc000xob0j847nmbcf"],
  },
  inventory: {
    itemId: "cmpc6xin1000pob0jkr0bnk0s",
  },
  auth: {
    adminEmails: [
      "admin.qa.staging@casa-antigua.local",
      "admin.qa.staging@casa-antigua.test",
    ],
  },
} as const;

async function main() {
  const reservationIds = [...ids.reservations.reservationIds];
  const adminEmails = [...ids.auth.adminEmails];

  const exists = {
    productImage: await prisma.productImage.findUnique({
      where: { id: ids.menu.imageId },
      select: { id: true },
    }),
    product: await prisma.product.findUnique({
      where: { id: ids.menu.productId },
      select: { id: true },
    }),
    subcategory: await prisma.subcategory.findUnique({
      where: { id: ids.menu.subcategoryId },
      select: { id: true },
    }),
    category: await prisma.category.findUnique({
      where: { id: ids.menu.categoryId },
      select: { id: true },
    }),
    reservations: await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, tableId: true },
    }),
    table: await prisma.table.findUnique({
      where: { id: ids.reservations.tableId },
      select: { id: true },
    }),
    inventoryItem: await prisma.inventoryItem.findUnique({
      where: { id: ids.inventory.itemId },
      select: { id: true },
    }),
    adminUsers: await prisma.adminUser.findMany({
      where: { email: { in: adminEmails } },
      select: { id: true, email: true },
    }),
  };

  const deleted = {
    productImage: 0,
    product: 0,
    subcategory: 0,
    category: 0,
    reservations: 0,
    table: 0,
    inventoryCount: 0,
    inventoryReceive: 0,
    inventoryWaste: 0,
    inventoryItem: 0,
    adminSessions: 0,
    adminUsers: 0,
  };

  if (exists.productImage) {
    await prisma.productImage.delete({ where: { id: ids.menu.imageId } });
    deleted.productImage = 1;
  }
  if (exists.product) {
    await prisma.product.delete({ where: { id: ids.menu.productId } });
    deleted.product = 1;
  }
  if (exists.subcategory) {
    await prisma.subcategory.delete({ where: { id: ids.menu.subcategoryId } });
    deleted.subcategory = 1;
  }
  if (exists.category) {
    await prisma.category.delete({ where: { id: ids.menu.categoryId } });
    deleted.category = 1;
  }

  if (exists.reservations.length > 0) {
    const res = await prisma.reservation.deleteMany({
      where: { id: { in: reservationIds } },
    });
    deleted.reservations = res.count;
  }

  if (exists.table) {
    await prisma.table.delete({ where: { id: ids.reservations.tableId } });
    deleted.table = 1;
  }

  if (exists.inventoryItem) {
    const count = await prisma.inventoryCount.deleteMany({
      where: { inventoryItemId: ids.inventory.itemId },
    });
    const receive = await prisma.inventoryReceiveRecord.deleteMany({
      where: { inventoryItemId: ids.inventory.itemId },
    });
    const waste = await prisma.inventoryWasteRecord.deleteMany({
      where: { inventoryItemId: ids.inventory.itemId },
    });
    await prisma.inventoryItem.delete({ where: { id: ids.inventory.itemId } });
    deleted.inventoryCount = count.count;
    deleted.inventoryReceive = receive.count;
    deleted.inventoryWaste = waste.count;
    deleted.inventoryItem = 1;
  }

  if (exists.adminUsers.length > 0) {
    const adminIds = exists.adminUsers.map((u: { id: string }) => u.id);
    const sessions = await prisma.adminSession.deleteMany({
      where: { userId: { in: adminIds } },
    });
    const users = await prisma.adminUser.deleteMany({
      where: { id: { in: adminIds } },
    });
    deleted.adminSessions = sessions.count;
    deleted.adminUsers = users.count;
  }

  const postCheck = {
    menuLeft: {
      category: await prisma.category.findUnique({ where: { id: ids.menu.categoryId } }),
      subcategory: await prisma.subcategory.findUnique({
        where: { id: ids.menu.subcategoryId },
      }),
      product: await prisma.product.findUnique({ where: { id: ids.menu.productId } }),
      image: await prisma.productImage.findUnique({ where: { id: ids.menu.imageId } }),
    },
    reservationsLeft: await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true },
    }),
    tableLeft: await prisma.table.findUnique({
      where: { id: ids.reservations.tableId },
      select: { id: true },
    }),
    inventoryLeft: await prisma.inventoryItem.findUnique({
      where: { id: ids.inventory.itemId },
      select: { id: true },
    }),
    adminLeft: await prisma.adminUser.findMany({
      where: { email: { in: adminEmails } },
      select: { id: true, email: true },
    }),
  };

  console.log(
    JSON.stringify(
      {
        exists: {
          productImage: Boolean(exists.productImage),
          product: Boolean(exists.product),
          subcategory: Boolean(exists.subcategory),
          category: Boolean(exists.category),
          reservations: exists.reservations.length,
          table: Boolean(exists.table),
          inventoryItem: Boolean(exists.inventoryItem),
          adminUsers: exists.adminUsers.length,
        },
        deleted,
        postCheck: {
          menuLeft: {
            category: Boolean(postCheck.menuLeft.category),
            subcategory: Boolean(postCheck.menuLeft.subcategory),
            product: Boolean(postCheck.menuLeft.product),
            image: Boolean(postCheck.menuLeft.image),
          },
          reservationsLeft: postCheck.reservationsLeft.length,
          tableLeft: Boolean(postCheck.tableLeft),
          inventoryLeft: Boolean(postCheck.inventoryLeft),
          adminLeft: postCheck.adminLeft.length,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
