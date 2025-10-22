// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import * as importPlugin from "eslint-plugin-import";
import path from "node:path";

export default defineConfig(
  {
    languageOptions: {
      ecmaVersion: 2022,
      parser: tseslint.parser,
      parserOptions: {
        project: path.join(import.meta.dirname, "tsconfig.json"),
        tsconfigRootDir: path.join(import.meta.dirname, "tsconfig.json"),
        projectService: true,
      },
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
    plugins: {
      import: importPlugin,
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "integration-tests/**/*.ts"],
    rules: {
      // Disable two rules that conflict with the patterns that we use
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      // We disable the following rule as it's a common pattern when using
      // the network provider directly
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: false,
        },
      ],
    },
  },
  {
    files: ["test/**/*.ts", "integration-tests/**/*.ts"],
    ignores: ["test/**/fixture-projects/**"],
    rules: {
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: true,
        },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          // Unfortunately `node:test` uses floating promises that we need to ignore
          allowForKnownSafeCalls: [
            {
              from: "package",
              name: ["describe", "suite", "it", "test"],
              package: "node:test",
            },
            // These are more permissive than needed, as they allow any call to functions
            // with these names to float a promise.
            "skip",
            "todo",
            "only",
          ],
        },
      ],
    },
  },
  {
    // This is a set of more opinionated rules. Feel free to adapt to your style.
    files: ["src/**/*.ts", "test/**/*.ts", "integration-tests/**/*.ts"],
    ignores: ["test/**/fixture-projects/**"],
    rules: {
      "import/order": "error",
    },
  },
);
