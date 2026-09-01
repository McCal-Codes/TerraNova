import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const browserGlobals = {
  ...globals.browser,
  ...globals.node,
};

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "src-tauri/**",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: browserGlobals,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: browserGlobals,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "off",
      // Catches hooks called conditionally or after an early return. Without
      // this, a useEffect placed below `if (!open) return null` lints clean and
      // then crashes at runtime with "Rendered more hooks than during the
      // previous render", taking the whole window blank.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The panels are meant to be opaque (see surfaceStyles.ts). Glass blur
      // kept creeping back one component at a time, and each addition looks
      // harmless on its own.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/backdrop-blur/]",
          message:
            "Panels are opaque by design — use the tn-panel/tn-surface tokens in surfaceStyles.ts instead of backdrop-blur.",
        },
        {
          selector: "TemplateElement[value.raw=/backdrop-blur/]",
          message:
            "Panels are opaque by design — use the tn-panel/tn-surface tokens in surfaceStyles.ts instead of backdrop-blur.",
        },
      ],
    },
  },
];
