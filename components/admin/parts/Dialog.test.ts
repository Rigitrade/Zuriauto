import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * One rule about `<dialog>`, enforced across the whole tree.
 *
 * A closed `<dialog>` is hidden by a single rule in the browser's own
 * stylesheet:
 *
 *     dialog:not([open]) { display: none }
 *
 * That rule lives in the user-agent origin, and every normal declaration in an
 * author stylesheet beats the user agent's regardless of specificity. So one
 * `flex` class on a `<dialog>` element unhides every closed dialog on the page
 * — not the open one, which looks fine, but the nine or thirty sitting there
 * waiting. On the fleet screen that is three dialogs per car, and it shipped:
 * the console rendered eleven cars' worth of modals stacked down the page.
 *
 * It fails in exactly the wrong way. The dialog you are testing is the one you
 * opened, and that one still works.
 *
 * So a layout that needs `display` goes on a wrapper *inside* the dialog,
 * where the cascade cannot reach the element's own visibility. A variant —
 * `open:flex` — is also correct, and is allowed below, because it applies only
 * while the dialog is open.
 *
 * Read from the compiler's own syntax tree rather than with a regular
 * expression. Two earlier attempts here were wrong in the way this kind of
 * check is usually wrong: `<dialog\b([^>]*)>` ended at the `>` of an arrow
 * function and matched nothing at all, and a hand-written scanner was sent
 * into a string it never left by the apostrophe in "parent's". Both reported
 * success. TypeScript is already a dependency and it knows where a tag ends.
 */

/** Everything Tailwind's `display` utilities can set. `flex-col` and friends
 *  are absent on purpose: they set other properties and are harmless here. */
const DISPLAY_UTILITIES = new Set([
  "block",
  "inline-block",
  "inline",
  "flex",
  "inline-flex",
  "table",
  "inline-table",
  "table-caption",
  "table-cell",
  "table-column",
  "table-column-group",
  "table-footer-group",
  "table-header-group",
  "table-row-group",
  "table-row",
  "flow-root",
  "grid",
  "inline-grid",
  "contents",
  "list-item",
  "hidden",
]);

/** Every `.tsx` under a directory a page can be built from. */
function sourceFiles(root: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(root)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (entry.endsWith(".tsx")) {
      found.push(path);
    }
  }

  return found;
}

/**
 * The class names on every `<dialog>` element in one file.
 *
 * A class name is rarely one literal. It is a template with holes in it, and
 * the holes hold a conditional (`wide ? … : …`) or a constant declared at the
 * top of the file. Every string reachable from the attribute is collected —
 * including, by name, the top-level `const x = "…"` that a hole refers to, so
 * that moving a class behind a constant does not move it out of view.
 */
function dialogClassNames(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  /** `const NAME = "…"` at the top level, so a hole naming one can be read. */
  const constants = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        ts.isStringLiteralLike(declaration.initializer)
      ) {
        constants.set(declaration.name.text, declaration.initializer.text);
      }
    }
  }

  const names: string[] = [];

  function collectStrings(node: ts.Node, into: string[]): void {
    if (ts.isStringLiteralLike(node)) {
      into.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      into.push(node.head.text);
      for (const span of node.templateSpans) {
        collectStrings(span.expression, into);
        into.push(span.literal.text);
      }
      return;
    } else if (ts.isIdentifier(node)) {
      const known = constants.get(node.text);
      if (known !== undefined) into.push(known);
      return;
    }

    node.forEachChild((child) => collectStrings(child, into));
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningLikeElement(node)) {
      const tag = node.tagName.getText(source);
      if (tag === "dialog") {
        for (const attribute of node.attributes.properties) {
          if (
            !ts.isJsxAttribute(attribute) ||
            attribute.name.getText(source) !== "className" ||
            !attribute.initializer
          ) {
            continue;
          }

          const strings: string[] = [];
          collectStrings(attribute.initializer, strings);
          names.push(strings.join(" "));
        }
      }
    }

    node.forEachChild(visit);
  }

  visit(source);
  return names;
}

describe("<dialog> elements", () => {
  const files = [
    ...sourceFiles(join(process.cwd(), "components")),
    ...sourceFiles(join(process.cwd(), "app")),
  ];

  it("finds the dialogs it is meant to be checking", () => {
    // Guards the guard, and has already earned its place twice: both earlier
    // versions of the reader above returned nothing, which made the rule below
    // pass by examining an empty list.
    const withDialogs = files.filter(
      (file) => dialogClassNames(file).length > 0
    );

    expect(withDialogs.length).toBeGreaterThan(0);
  });

  it("reads the whole class name, holes and constants included", () => {
    // The reader is the part that breaks silently, so it is tested directly
    // rather than only through the rule. These three come from the shared
    // Dialog: a constant, a literal, and the width behind a conditional.
    const shared = dialogClassNames(join(process.cwd(), "components/admin/parts/Dialog.tsx"));

    expect(shared).toHaveLength(1);
    expect(shared[0]).toContain("max-h-[calc(100dvh-3rem)]");
    expect(shared[0]).toContain("backdrop:bg-[#14191A]/45");
    expect(shared[0]).toContain("w-[min(32rem,calc(100vw-2rem))]");
  });

  it("never carries an unconditional display utility", () => {
    const offences: string[] = [];

    for (const file of files) {
      for (const className of dialogClassNames(file)) {
        for (const token of className.split(/\s+/).filter(Boolean)) {
          // A variant — `open:flex`, `sm:grid` — applies only when its
          // condition holds, so it cannot unhide a closed dialog.
          if (token.includes(":")) continue;
          if (DISPLAY_UTILITIES.has(token)) offences.push(`${file}: ${token}`);
        }
      }
    }

    expect(offences).toEqual([]);
  });
});
