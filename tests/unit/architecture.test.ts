import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import ts from "typescript";
const root = resolve(import.meta.dirname, "../..");
const prefixes: Record<string, string> = {
  "@frontend/": "apps/frontend/",
  "@backend/": "apps/backend/src/",
  "@shared/": "packages/shared/",
  "@domain/": "packages/domain/",
  "@ai/": "packages/ai/",
  "@data/": "data/",
};
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    [".next", "node_modules"].includes(e.name)
      ? []
      : e.isDirectory()
        ? files(resolve(dir, e.name))
        : /\.(ts|tsx)$/.test(e.name)
          ? [resolve(dir, e.name)]
          : [],
  );
}
function imports(file: string) {
  const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
    found: string[] = [];
  function visit(n: ts.Node) {
    if (
      (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
      n.moduleSpecifier &&
      ts.isStringLiteral(n.moduleSpecifier)
    )
      found.push(n.moduleSpecifier.text);
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    )
      found.push(n.arguments[0].text);
    ts.forEachChild(n, visit);
  }
  visit(source);
  return found;
}
describe("Enforced dependency direction", () => {
  it("keeps UI, domain, AI and database responsibilities separated, including relative imports", () => {
    const violations: string[] = [];
    for (const file of [
      ...files(resolve(root, "apps")),
      ...files(resolve(root, "packages")),
    ]) {
      const from = relative(root, file).replaceAll("\\", "/");
      for (const spec of imports(file)) {
        let to = spec;
        for (const [alias, path] of Object.entries(prefixes))
          if (spec.startsWith(alias)) to = path + spec.slice(alias.length);
        if (spec.startsWith("."))
          to = relative(root, resolve(dirname(file), spec)).replaceAll(
            "\\",
            "/",
          );
        let blocked = false;
        if (
          from.startsWith("apps/frontend/") &&
          !from.startsWith("apps/frontend/app/api/")
        )
          blocked =
            /^(apps\/backend|packages\/(domain|ai)|data\/|@prisma)/.test(to);
        if (from.startsWith("packages/domain/"))
          blocked = /^(apps\/|packages\/ai|data\/|@prisma|react$|next\/)/.test(
            to,
          );
        if (from.startsWith("packages/shared/"))
          blocked =
            /^(apps\/|packages\/(ai|domain)|data\/|@prisma|react$|next\/)/.test(
              to,
            );
        if (from.startsWith("packages/ai/"))
          blocked = /^(apps\/|data\/|@prisma|react$|next\/)/.test(to);
        if (from.startsWith("apps/backend/src/services/"))
          blocked = /^(apps\/frontend|data\/|@prisma)/.test(to);
        if (from.startsWith("apps/backend/src/api/"))
          blocked =
            /^(data\/|@prisma|apps\/backend\/src\/repositories|packages\/(domain|ai))/.test(
              to,
            );
        if (blocked) violations.push(from + " → " + spec);
      }
    }
    expect(violations).toEqual([]);
  });
  it("keeps framework route adapters small and domain code usable without Next.js", () => {
    const route = readFileSync(
      resolve(root, "apps/frontend/app/api/[...path]/route.ts"),
      "utf8",
    );
    expect(route.split("\n").length).toBeLessThan(20);
    expect(route).not.toContain("db.");
    expect(
      existsSync(resolve(root, "packages/domain/career/readiness.ts")),
    ).toBe(true);
  });
});
