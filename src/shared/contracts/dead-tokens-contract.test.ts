import { describe, expect, it } from "vitest";

import { readRepoFile } from "./contract-files";

/**
 * C1-3 de `plan2uiux.md` — sin bloque `.dark` y sin tokens huérfanos.
 *
 * TASK-201 midió que el bloque `.dark` de `globals.css` tenía **31 tokens que nunca se aplican** (no
 * hay ninguna clase `dark` en el DOM: no existe modo oscuro en el producto y el plan lo declara fuera
 * de alcance) y que otros **16 tokens** estaban declarados y sin un solo consumidor, sobrante de un
 * scaffold tipo shadcn. Un token muerto no es gratis: aparece en el autocompletado, invita a usarlo y
 * hace dudar de cuál es el sistema real.
 *
 * Este contrato fija el resultado medido: los tokens prohibidos **no están declarados en ningún lado**
 * (ni `:root`, ni `@theme`, ni `DESIGN_SYSTEM.md` §2.1) y el bloque `.dark` no existe. Si alguien
 * necesita uno de verdad, este test lo va a decir: agrega el token **y** su consumo en el mismo
 * commit, y saca la fila de la lista de prohibidos.
 */

const GLOBALS_CSS = "src/app/globals.css";
const DESIGN_SYSTEM_DOC = "DESIGN_SYSTEM.md";

/** Los 16 tokens sin consumidor: los 15 que ya prohibía §2.1 más `--ring`. */
const FORBIDDEN_TOKENS = [
  "--primary",
  "--primary-foreground",
  "--popover",
  "--popover-foreground",
  "--accent-foreground",
  "--destructive",
  "--ink-green-foreground",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--ring",
];

describe("contrato · tokens muertos y bloque .dark (C1-3)", () => {
  it("globals.css no declara ningún token prohibido", () => {
    const css = readRepoFile(GLOBALS_CSS);
    const declared = FORBIDDEN_TOKENS.filter((token) =>
      new RegExp(`^\\s*${token}:`, "m").test(css),
    );

    expect(
      declared,
      "un token sin consumidor se borra del CSS en vez de quedar como superficie muerta",
    ).toEqual([]);
  });

  it("globals.css no define el bloque .dark", () => {
    const css = readRepoFile(GLOBALS_CSS);

    expect(/^\s*\.dark\s*\{/m.test(css)).toBe(false);
  });

  it("no queda ninguna variante dark de Tailwind", () => {
    const css = readRepoFile(GLOBALS_CSS);

    expect(css).not.toContain("@custom-variant dark");
  });

  it("DESIGN_SYSTEM.md no manda a usar tokens que ya no existen", () => {
    const doc = readRepoFile(DESIGN_SYSTEM_DOC);

    // §2.1 es la lista de prohibidos: puede nombrarlos. Lo que no puede es declararlos en el
    // frontmatter (como `--ring`) ni recomendarlos en la tabla de "cuándo usar qué color".
    const frontmatter = doc.split(/^---\s*$/m)[1] ?? "";
    const declared = FORBIDDEN_TOKENS.filter((token) =>
      new RegExp(`name:\\s*"${token}"`).test(frontmatter),
    );

    expect(declared, "el design system no puede declarar un token que el CSS ya no tiene").toEqual(
      [],
    );
  });
});
