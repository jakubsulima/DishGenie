import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const sourceRoot = join(process.cwd(), "src");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : [".ts", ".tsx"].includes(extname(entry.name))
        ? [path]
        : [];
  });

const literalTranslationKeys = (path: string): string[] => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const keys: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t"
    ) {
      const argument = node.arguments[0];
      if (
        argument &&
        (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        keys.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return keys;
};

const polishCatalogueKeys = (): Set<string> => {
  const path = join(sourceRoot, "context", "languageContext.tsx");
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const keys = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
        && node.name.text === "polishTranslations" && node.initializer
        && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name;
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
          keys.add(name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return keys;
};

describe("Polish translation catalogue", () => {
  test("covers every literal UI translation key", () => {
    const catalogueKeys = polishCatalogueKeys();
    const missing = sourceFiles(sourceRoot)
      .flatMap(literalTranslationKeys)
      .filter((key) => !catalogueKeys.has(key));

    expect([...new Set(missing)].sort()).toEqual([]);
  });
});
