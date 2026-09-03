import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { ModifierGroupRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type GetAdminModifierGroupDependencies = {
  repository: MenuRepository;
};

export async function getAdminModifierGroup(
  id: string,
  { repository }: GetAdminModifierGroupDependencies,
): Promise<{ data: ModifierGroupRecord }> {
  const group = await repository.getModifierGroupById(id);
  if (!group) {
    throw new MenuError(404, "NOT_FOUND", "Modifier group not found");
  }
  return { data: group };
}
