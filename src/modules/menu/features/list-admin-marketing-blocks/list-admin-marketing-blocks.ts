import type { MenuMarketingBlockRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ListAdminMarketingBlocksDependencies = {
  repository: MenuRepository;
};

export async function listAdminMarketingBlocks(
  { repository }: ListAdminMarketingBlocksDependencies,
): Promise<{ data: MenuMarketingBlockRecord[] }> {
  const blocks = await repository.listMarketingBlocks();
  return { data: blocks };
}
