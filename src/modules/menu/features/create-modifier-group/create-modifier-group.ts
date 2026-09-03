import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { ModifierGroupRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ModifierOptionInput = {
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
};

type CreateModifierGroupInput = {
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOptionInput[];
};

type CreateModifierGroupDependencies = {
  repository: MenuRepository;
};

export async function createModifierGroup(
  input: CreateModifierGroupInput,
  { repository }: CreateModifierGroupDependencies,
): Promise<{ data: ModifierGroupRecord; meta: { updatedAt: string } }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (typeof input.minSelections !== "number" || typeof input.maxSelections !== "number") {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", {
      minSelections: "Required",
      maxSelections: "Required",
    });
  }

  if (input.maxSelections < 0) {
    throw new MenuError(422, "VALIDATION_ERROR", "maxSelections must be >= 0", {
      maxSelections: "Must be >= 0",
    });
  }

  if (input.minSelections > input.maxSelections) {
    throw new MenuError(422, "VALIDATION_ERROR", "minSelections cannot exceed maxSelections", {
      minSelections: "Cannot exceed maxSelections",
    });
  }

  if (!Array.isArray(input.options) || input.options.length === 0) {
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

  const group = await repository.createModifierGroup({
    name: input.name.trim(),
    isRequired: input.isRequired,
    minSelections: input.minSelections,
    maxSelections: input.maxSelections,
    sortOrder: input.sortOrder ?? 0,
    options: input.options.map((opt) => ({
      name: opt.name.trim(),
      priceDelta: opt.priceDelta ?? 0,
      isActive: opt.isActive,
      sortOrder: opt.sortOrder ?? 0,
    })),
  });

  return {
    data: group,
    meta: { updatedAt: new Date().toISOString() },
  };
}
