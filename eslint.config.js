import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Use the seeded PRNG: the simulation must be deterministic.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: "Never use innerHTML: use textContent (untrusted level data).",
        },
      ],
      "no-eval": "error",
      "no-new-func": "error",
    },
  },
  {
    // The config file itself is plain JS: skip type-aware rules there.
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
