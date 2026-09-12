export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowUpRight, LayoutList, Megaphone, PackageOpen, Percent, SlidersHorizontal } from "lucide-react";

import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";

const MENU_SECTIONS = [
  {
    href: "/admin/menu/products",
    label: "Productos",
    description: "Disponibilidad, precio, fotos y catálogo por categoría.",
    action: "Gestionar productos",
    icon: PackageOpen,
  },
  {
    href: "/admin/menu/categories",
    label: "Categorías",
    description: "Jerarquía de categorías y subcategorías del menú.",
    action: "Gestionar categorías",
    icon: LayoutList,
  },
  {
    href: "/admin/menu/modifier-groups",
    label: "Modificadores",
    description: "Opciones, extras y reglas disponibles para productos.",
    action: "Gestionar modificadores",
    icon: SlidersHorizontal,
  },
  {
    href: "/admin/menu/marketing-blocks",
    label: "Hero comercial",
    description: "Promos, eventos, combos y destacados del menú público.",
    action: "Gestionar hero comercial",
    icon: Megaphone,
  },
  {
    href: "/admin/promotions",
    label: "Promos con código",
    description: "Descuentos que el cliente aplica en el checkout con un código.",
    action: "Gestionar promos",
    icon: Percent,
  },
];

export default async function MenuDashboardPage() {
  const repository = new PrismaMenuRepository();
  const [categories, subcategories, activeProducts, unavailableActiveProducts] = await Promise.all([
    repository.listCategories(),
    repository.listSubcategories({ isActive: true }),
    repository.listProducts({ isActive: true }),
    repository.listProducts({ isActive: true, isAvailable: false }),
  ]);

  const activeCategoriesCount = categories.filter((category) => category.isActive).length;

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Catálogo</p>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">Gestión del menú</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Productos, estructura y promociones sin perder contexto operativo.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm" aria-label="Secciones del menú">
        <div className="divide-y divide-border">
          {MENU_SECTIONS.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.href}
                href={section.href}
                className="menu-section-row group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/35"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{section.label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{section.description}</span>
                </span>
                <span className="hidden items-center gap-1 text-sm font-semibold text-brand sm:inline-flex">
                  {section.action}
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand sm:hidden" strokeWidth={2} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Catálogo operativo">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catálogo operativo</p>
          <p className="mt-1 text-sm text-muted-foreground">Estado actual de elementos activos; no incluye archivados.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{activeCategoriesCount}</strong> categorías</span>
          <span><strong className="text-foreground">{subcategories.length}</strong> subcategorías</span>
          <span><strong className="text-foreground">{activeProducts.length}</strong> productos</span>
          <span><strong className="text-foreground">{unavailableActiveProducts.length}</strong> agotados</span>
        </div>
      </section>
    </div>
  );
}
