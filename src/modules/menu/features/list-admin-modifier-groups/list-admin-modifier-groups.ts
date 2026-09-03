import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ListAdminModifierGroupsDependencies = {
  repository: MenuRepository;
};

export async function listAdminModifierGroups({
  repository,
}: ListAdminModifierGroupsDependencies) {
  const groups = await repository.listModifierGroups();
  return { data: groups };
}
