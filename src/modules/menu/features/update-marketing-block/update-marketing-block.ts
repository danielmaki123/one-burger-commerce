import { MenuError } from "@/modules/menu/domain/menu-errors";
import { validateMarketingBlockInput } from "@/modules/menu/features/marketing-blocks/validate-marketing-block-input";
import type { MenuMarketingBlockRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type UpdateMarketingBlockInput = {
  type?: MenuMarketingBlockRecord["type"];
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaType?: MenuMarketingBlockRecord["ctaType"];
  ctaTarget?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

type UpdateMarketingBlockDependencies = {
  repository: MenuRepository;
};

export async function updateMarketingBlock(
  id: string,
  input: UpdateMarketingBlockInput,
  { repository }: UpdateMarketingBlockDependencies,
): Promise<{ data: MenuMarketingBlockRecord; meta: { updatedAt: string } }> {
  const existing = await repository.findMarketingBlockById(id);
  if (!existing) {
    throw new MenuError(404, "NOT_FOUND", "Marketing block not found");
  }

  const normalized = await validateMarketingBlockInput(
    {
      type: input.type ?? existing.type,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      imageUrl: input.imageUrl ?? existing.imageUrl,
      ctaLabel: input.ctaLabel ?? existing.ctaLabel,
      ctaType: input.ctaType ?? existing.ctaType,
      ctaTarget: input.ctaTarget ?? existing.ctaTarget,
      isActive: input.isActive ?? existing.isActive,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      startsAt: input.startsAt !== undefined ? input.startsAt : existing.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
    },
    repository,
  );

  const block = await repository.updateMarketingBlock(id, normalized);

  return {
    data: block,
    meta: { updatedAt: new Date().toISOString() },
  };
}
