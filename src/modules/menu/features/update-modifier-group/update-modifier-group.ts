import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { ModifierGroupRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ModifierOptionInput = {
  id?: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
};

type UpdateModifierGroupInput = {
  name?: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
  options?: ModifierOptionInput[];
};

type UpdateModifierGroupDependencies = {
  repository: MenuRepository;
};

export async function updateModifierGroup(
  id: string,
  input: UpdateModifierGroupInput,
  { repository }: UpdateModifierGroupDependencies,
): Promise<{ data: ModifierGroupRecord; meta: { updatedAt: string } }> {
  const existing = await repository.getModifierGroupById(id);
  if (!existing) {
    throw new MenuError(404, "NOT_FOUND", "Modifier group not found");
  }

  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  const minSelections = input.minSelections ?? existing.minSelections;
  const maxSelections = input.maxSelections ?? existing.maxSelections;

  if (input.maxSelections !== undefined && input.maxSelections < 0) {
    throw new MenuError(422, "VALIDATION_ERROR", "maxSelections must be >= 0", {
      maxSelections: "Must be >= 0",
    });
  }

  if (minSelections > maxSelections) {
    throw new MenuError(422, "VALIDATION_ERROR", "minSelections cannot exceed maxSelections", {
      minSelections: "Cannot exceed maxSelections",
    });
  }

  if (input.options !== undefined) {
    if (input.options.length === 0) {
      throw new MenuError(422, "VALIDATION_ERROR", "At least one option is required", {
        options: "Required",
      });
    }

    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i];
      if (!opt.name || opt.name.trim().length === 0) {
        throw new MenuError(400, "BAD_REQUEST", "Invalid payload", {
          [`options[${i}].name`]: "Required",
        });
      }
    }

    const activeOptions = input.options.filter((opt) => opt.isActive);
    if (activeOptions.length === 0) {
      throw new MenuError(422, "VALIDATION_ERROR", "At least one active option is required", {
        options: "Must have at least one active option",
      });
    }

    // Integrity guard: reject option IDs from other groups
    const existingOptionIds = new Set(existing.options.map((o) => o.id));
    for (const opt of input.options) {
      if (opt.id && !existingOptionIds.has(opt.id)) {
        throw new MenuError(422, "VALIDATION_ERROR", "Option does not belong to this group", {
          options: "Invalid option ID for this group",
        });
      }
    }
  }

  try {
    const group = await repository.updateModifierGroup(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
      ...(input.minSelections !== undefined ? { minSelections: input.minSelections } : {}),
      ...(input.maxSelections !== undefined ? { maxSelections: input.maxSelections } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.options !== undefined
        ? {
            options: input.options.map((opt) => ({
              id: opt.id,
              name: opt.name.trim(),
              priceDelta: opt.priceDelta ?? 0,
              isActive: opt.isActive,
              sortOrder: opt.sortOrder ?? 0,
            })),
          }
        : {}),
    });

    return {
      data: group,
      meta: { updatedAt: new Date().toISOString() },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not belong to ModifierGroup")) {
      throw new MenuError(409, "CONFLICT", "One or more options do not belong to this modifier group");
    }
    throw error;
  }
}
