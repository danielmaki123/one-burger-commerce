// Local dev seed — run after: docker-compose up -d → npx prisma migrate dev → npx prisma db seed
// Creates: 1 admin, 3 categories, 3 subcategories, 5 products, 4 tables

import { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_BUSINESS_SETTINGS } from "../src/modules/business-settings/domain/business-settings-defaults";
import { hashPassword } from "../src/shared/lib/auth/password-hasher";

const prisma = new PrismaClient();

async function main() {
  // Admin user
  await prisma.adminUser.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin One Burger",
      email: "admin@example.com",
      passwordHash: hashPassword("Admin1234!"),
      role: "owner",
    },
  });

  // Configuración del negocio: los valores salen del módulo de defaults, no se
  // copian acá (una sola fuente de verdad para el branding).
  //
  // Excepción: el horario se abre de 00:00 a 23:59 **solo en local/demo**. El seed
  // nunca corre en producción, y con el horario real (12:00-22:00) el servidor
  // rechaza los pedidos fuera de esa franja: los E2E de creación de pedido pasarían
  // o fallarían según la hora a la que se corran.
  const demoHours = Object.fromEntries(
    Object.entries(DEFAULT_BUSINESS_SETTINGS.businessHours).map(([weekday, day]) => [
      weekday,
      { ...day, open: "00:00", close: "23:59" },
    ]),
  ) as unknown as Prisma.InputJsonValue;

  await prisma.businessSettings.upsert({
    where: { id: DEFAULT_BUSINESS_SETTINGS.id },
    update: {},
    create: {
      ...DEFAULT_BUSINESS_SETTINGS,
      businessHours: demoHours,
    },
  });

  // Categories
  const tacos = await prisma.category.upsert({
    where: { slug: "tacos" },
    update: {},
    create: { name: "Tacos", slug: "tacos", sortOrder: 1 },
  });

  const bebidas = await prisma.category.upsert({
    where: { slug: "bebidas" },
    update: {},
    create: { name: "Bebidas", slug: "bebidas", sortOrder: 2 },
  });

  const postres = await prisma.category.upsert({
    where: { slug: "postres" },
    update: {},
    create: { name: "Postres", slug: "postres", sortOrder: 3 },
  });

  // Subcategories
  const especiales = await prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId: tacos.id, slug: "especiales" } },
    update: {},
    create: { categoryId: tacos.id, name: "Especiales", slug: "especiales", sortOrder: 1 },
  });

  const tradicionales = await prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId: tacos.id, slug: "tradicionales" } },
    update: {},
    create: { categoryId: tacos.id, name: "Tradicionales", slug: "tradicionales", sortOrder: 2 },
  });

  const frias = await prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId: bebidas.id, slug: "frias" } },
    update: {},
    create: { categoryId: bebidas.id, name: "Frías", slug: "frias", sortOrder: 1 },
  });

  // Products (stable IDs for idempotency)
  await prisma.product.upsert({
    where: { id: "seed-prod-01" },
    update: {},
    create: {
      id: "seed-prod-01",
      categoryId: tacos.id,
      subcategoryId: especiales.id,
      name: "Taco de Birria",
      description: "Taco de res estilo Jalisco con consomé",
      basePrice: 35,
      sortOrder: 1,
    },
  });

  await prisma.product.upsert({
    where: { id: "seed-prod-02" },
    update: {},
    create: {
      id: "seed-prod-02",
      categoryId: tacos.id,
      subcategoryId: especiales.id,
      name: "Taco de Asada",
      description: "Carne de res a las brasas",
      basePrice: 30,
      sortOrder: 2,
    },
  });

  await prisma.product.upsert({
    where: { id: "seed-prod-03" },
    update: {},
    create: {
      id: "seed-prod-03",
      categoryId: tacos.id,
      subcategoryId: tradicionales.id,
      name: "Taco de Pastor",
      description: "Cerdo marinado con achiote",
      basePrice: 28,
      sortOrder: 3,
    },
  });

  await prisma.product.upsert({
    where: { id: "seed-prod-04" },
    update: {},
    create: {
      id: "seed-prod-04",
      categoryId: bebidas.id,
      subcategoryId: frias.id,
      name: "Agua de Jamaica",
      description: "Agua fresca de flor de jamaica",
      basePrice: 25,
      sortOrder: 1,
    },
  });

  await prisma.product.upsert({
    where: { id: "seed-prod-05" },
    update: {},
    create: {
      id: "seed-prod-05",
      categoryId: postres.id,
      subcategoryId: null,
      name: "Flan Napolitano",
      description: "Flan casero con cajeta",
      basePrice: 40,
      sortOrder: 1,
    },
  });

  // Tables (qrToken is unique — safe for upsert)
  for (const [i, label] of ["Mesa 1", "Mesa 2", "Mesa 3", "Barra 1"].entries()) {
    await prisma.table.upsert({
      where: { qrToken: `seed-table-0${i + 1}` },
      update: {},
      create: {
        label,
        qrToken: `seed-table-0${i + 1}`,
        isActive: true,
        locationId: "main",
        capacity: i === 3 ? 2 : 4,
      },
    });
  }

  console.log(
    "Seed completed: admin + business settings + 3 categories + 3 subcategories + 5 products + 4 tables.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
