import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const block = (groups) => [
  "error",
  {
    patterns: groups.map((group) => ({
      group,
      message:
        "Respect module dependency direction; use shared contracts or the designated interface.",
    })),
  },
];
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    settings: { next: { rootDir: "apps/frontend/" } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    ignores: ["apps/frontend/app/api/**", "apps/frontend/next.config.ts"],
    rules: {
      "no-restricted-imports": block([
        ["@backend/*", "@domain/*", "@ai/*", "@data/*", "@prisma/*"],
      ]),
    },
  },
  {
    files: ["packages/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": block([
        [
          "@frontend/*",
          "@backend/*",
          "@ai/*",
          "@data/*",
          "@prisma/*",
          "react",
          "next",
          "next/*",
        ],
      ]),
    },
  },
  {
    files: ["packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": block([
        [
          "@frontend/*",
          "@backend/*",
          "@ai/*",
          "@data/*",
          "@domain/*",
          "@prisma/*",
          "react",
          "next",
          "next/*",
        ],
      ]),
    },
  },
  {
    files: ["packages/ai/**/*.ts"],
    rules: {
      "no-restricted-imports": block([
        [
          "@frontend/*",
          "@backend/*",
          "@data/*",
          "@prisma/*",
          "react",
          "next",
          "next/*",
        ],
      ]),
    },
  },
  {
    files: ["apps/backend/src/api/**/*.ts"],
    rules: {
      "no-restricted-imports": block([
        [
          "@data/*",
          "@prisma/*",
          "@ai/*",
          "@domain/*",
          "@backend/repositories",
          "@backend/repositories/*",
        ],
      ]),
    },
  },
  {
    files: ["apps/backend/src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": block([
        ["@data/*", "@prisma/*", "@frontend/*", "react"],
      ]),
    },
  },
  globalIgnores([
    "**/.next/**",
    "node_modules/**",
    "**/next-env.d.ts",
    "artifacts/**",
    "coverage/**",
  ]),
]);
