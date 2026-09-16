export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  ArrowUpRight,
  LayoutList,
  Megaphone,
  PackageOpen,
  Percent,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from "lucide-react";

import { getPublicBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { listPromotions } from "@/modules/orders/features/list-promotions/list-promotions";

import { AdminMetricStrip, AdminPageHeader } from "../_components/admin-operational-ui";
import { pluralEs } from "./categories/category-list-helpers";
import { MARKETING_TYPE_LABELS } from "./marketing-blocks/marketing-block-helpers";
import { summarizeMenuHub } from "./menu-hub-helpers";

type MenuTone = "neutral" | "pending" | "ready";

const BADGE_TONES: Record<MenuTone, string> = {
  neutral: "bg-surface-elevated text-ink-secondary",
  pending: "bg-status-pending-bg text-status-pending-text",
  ready: "bg-status-ready-bg text-status-ready-text",
};

/**
 * Hub del catálogo (`/admin/menu`).
 *
 * Traduce la referencia del módulo central: cabecera con el estado del canal online, vista previa del
 * hero comercial, las cinco secciones con su dato real al lado y el catálogo operativo en cuatro
 * tarjetas.
 *
 * Lo que la referencia muestra y acá **no** va, con su motivo: "Replicar a POS" no existe en el
 * backend (el menú público y el POS leen el mismo catálogo); las fotos con "84 órdenes hoy" y los
 * precios de las tarjetas son datos que la pantalla no tiene —la vista previa muestra los bloques
 * comerciales reales—; y "Canal Online v4.12" es una versión inventada: acá el chip dice si el negocio
 * está recibiendo pedidos.
 */
export default async function MenuDashboardPage() {
  const repository = new PrismaMenuRepository();
  const now = new Date();

  const [
    categories,
    subcategories,
    activeProducts,
    modifierGroups,
    marketingBlocks,
    promotions,
    settings,
  ] = await Promise.all([
    repository.listCategories(),
    repository.listSubcategories({ isActive: true }),
    repository.listProducts({ isActive: true }),
    repository.listModifierGroups(),
    repository.listMarketingBlocks(),
    listPromotions({ repository: new PrismaOrderRepository(), now }),
    getPublicBusinessSettings(),
  ]);

  const summary = summarizeMenuHub(
    {
      categories,
      subcategories,
      activeProducts,
      modifierGroups,
      marketingBlocks,
      promotions: promotions.data,
    },
    now.getTime(),
  );

  const sections = [
    {
      href: "/admin/menu/products",
      label: "Productos",
      badge: pluralEs(summary.products, "activo", "activos"),
      tone: "neutral" as MenuTone,
      description: "Disponibilidad, precio, fotos y catálogo por categoría.",
      meta:
        summary.unavailable === 0
          ? "Todo con stock"
          : pluralEs(summary.unavailable, "producto sin stock", "productos sin stock"),
      action: "Gestionar productos",
      icon: PackageOpen,
    },
    {
      href: "/admin/menu/categories",
      label: "Categorías",
      badge: pluralEs(summary.categories, "principal", "principales"),
      tone: "neutral" as MenuTone,
      description: "Jerarquía de categorías y subcategorías del menú.",
      meta: pluralEs(summary.subcategories, "subnivel", "subniveles"),
      action: "Gestionar categorías",
      icon: LayoutList,
    },
    {
      href: "/admin/menu/modifier-groups",
      label: "Modificadores",
      badge: pluralEs(summary.modifierGroups, "grupo", "grupos"),
      tone: "neutral" as MenuTone,
      description: "Opciones, extras y reglas disponibles para productos.",
      meta: "Opciones y extras",
      action: "Gestionar modificadores",
      icon: SlidersHorizontal,
    },
    {
      href: "/admin/menu/marketing-blocks",
      label: "Hero comercial",
      badge: summary.activeBlocks > 0 ? pluralEs(summary.activeBlocks, "visible hoy", "visibles hoy") : "Sin bloques",
      tone: summary.activeBlocks > 0 ? ("ready" as MenuTone) : ("pending" as MenuTone),
      description: "Promos, eventos, combos y destacados del menú público.",
      meta: "Se ven en la web del menú",
      action: "Gestionar hero comercial",
      icon: Megaphone,
    },
    {
      href: "/admin/promotions",
      label: "Promos con código",
      badge: pluralEs(summary.activePromotions, "activa", "activas"),
      tone: summary.activePromotions > 0 ? ("ready" as MenuTone) : ("neutral" as MenuTone),
      description: "Descuentos que el cliente aplica en el checkout con un código.",
      meta: "Se aplican en el checkout",
      action: "Gestionar promos",
      icon: Percent,
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <AdminPageHeader
        label="Catálogo · Módulo central"
        title="Gestión del menú"
        description="Productos, estructura y promociones sin perder contexto operativo."
        actions={
          <span className="inline-flex min-h-11 items-center gap-2 rounded-stitch-md border border-line-subtle bg-surface-low px-3 text-st-body font-semibold text-ink-secondary">
            {settings.isAcceptingOrders ? (
              <Wifi aria-hidden="true" className="h-4 w-4 text-status-ready-text" />
            ) : (
              <WifiOff aria-hidden="true" className="h-4 w-4 text-status-sla-text" />
            )}
            Canal online {settings.isAcceptingOrders ? "activo" : "en pausa"}
          </span>
        }
      />

      {summary.visiblePromotions.length > 0 ? (
        <section aria-labelledby="menu-hero-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="menu-hero-title" className="font-heading text-st-h3 font-bold text-ink">
                Hero comercial
              </h2>
              <p className="mt-0.5 text-st-caption text-ink-secondary">
                Lo que el cliente ve arriba en el menú público, hoy.
              </p>
            </div>
            <Link
              href="/admin/menu/marketing-blocks"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-stitch-md px-3 text-st-body font-semibold text-brand-primary hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Gestionar
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.visiblePromotions.map((block) => (
              <li
                key={block.id}
                className="min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1"
              >
                {block.imageUrl ? (
                  <img
                    src={block.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-28 w-full object-cover"
                  />
                ) : null}
                <div className="space-y-1 p-3">
                  <p className="text-st-overline font-bold uppercase tracking-wider text-brand-amber">
                    {MARKETING_TYPE_LABELS[block.type]}
                  </p>
                  <p className="text-st-body font-semibold text-ink">{block.title}</p>
                  {block.description ? (
                    <p className="line-clamp-2 text-st-caption leading-5 text-ink-secondary">
                      {block.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card shadow-elevation-1"
        aria-label="Secciones del menú"
      >
        <div className="divide-y divide-line-subtle">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.href}
                href={section.href}
                className="menu-section-row group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary motion-reduce:transition-none"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md bg-surface-low text-brand-primary">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-st-body font-semibold text-ink">{section.label}</span>
                    <span
                      className={`rounded-stitch-sm px-2 py-0.5 font-mono text-st-caption font-semibold tabular-nums ${BADGE_TONES[section.tone]}`}
                    >
                      {section.badge}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-st-caption text-ink-secondary">
                    {section.description}
                  </span>
                </span>
                <span className="hidden shrink-0 text-st-caption text-ink-muted md:inline">
                  {section.meta}
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-st-body font-semibold text-brand-primary sm:inline-flex">
                  {section.action}
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-brand-primary sm:hidden"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-label="Catálogo operativo">
        <div>
          <h2 className="font-heading text-st-h3 font-bold text-ink">Catálogo operativo</h2>
          <p className="mt-0.5 text-st-caption text-ink-secondary">
            Estado actual de elementos activos; no incluye archivados.
          </p>
        </div>
        <AdminMetricStrip
          columnsClassName="grid-cols-2 lg:grid-cols-4"
          items={[
            {
              label: "Estructura",
              value: summary.categories,
              helper: "categorías activas",
              icon: <LayoutList aria-hidden="true" className="h-4 w-4" strokeWidth={2} />,
            },
            {
              label: "Subniveles",
              value: summary.subcategories,
              helper: "subcategorías activas",
            },
            {
              label: "Catálogo",
              value: summary.products,
              helper: "productos activos",
              icon: <PackageOpen aria-hidden="true" className="h-4 w-4" strokeWidth={2} />,
            },
            {
              label: "Disponibilidad",
              value: summary.unavailable,
              helper: summary.unavailable === 0 ? "sin agotados" : "agotados",
              tone: summary.unavailable > 0 ? "warning" : "neutral",
            },
          ]}
        />
      </section>
    </div>
  );
}
