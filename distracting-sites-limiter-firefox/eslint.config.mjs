import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
  {
    // Main source files
    files: ["**/*.js"],
    ignores: ["tests/**/*.js", "coverage/**/*.js"],
    extends: compat.extends("eslint:recommended"),
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.webextensions,
            global: "readonly", // For global references in source files  
        },
    },
    rules: {
        "no-prototype-builtins": "error",
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    }
  },
  {
    // Test files
    files: ["tests/**/*.js"],
    extends: compat.extends("eslint:recommended"),
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.webextensions,
            ...globals.jest,
            global: "writable", // For test files that modify global
        },
    },
    rules: {
        "no-prototype-builtins": "error",
        "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    }
  },
  {
    // Coverage files - ignore
    files: ["coverage/**/*.js"],
    ignores: ["coverage/**/*.js"]
  }
]);