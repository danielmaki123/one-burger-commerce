import { validateMarketingBlockInput } from "@/modules/menu/features/marketing-blocks/validate-marketing-block-input";
import type { MenuMarketingBlockRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type CreateMarketingBlockInput = {
  type: MenuMarketingBlockRecord["type"];
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaType: MenuMarketingBlockRecord["ctaType"];
  ctaTarget?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

type CreateMarketingBlockDependencies = {
  repository: MenuRepository;
};

export async function createMarketingBlock(
  input: CreateMarketingBlockInput,
  { repository }: CreateMarketingBlockDependencies,
): Promise<{ data: MenuMarketingBlockRecord; meta: { updatedAt: string } }> {
  const normalized = await validateMarketingBlockInput(
    {
      ...input,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    repository,
  );

  const block = await repository.createMarketingBlock(normalized);

  return {
    data: block,
    meta: { updatedAt: new Date().toISOString() },
  };
}
