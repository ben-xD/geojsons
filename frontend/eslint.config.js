import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintReactRecommended from "eslint-plugin-react/configs/recommended.js";
import eslintReactJsxRuntime from "eslint-plugin-react/configs/jsx-runtime.js";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintPluginPrettier from "eslint-plugin-prettier";
import tseslintParser from "@typescript-eslint/parser";
import eslintPluginReactRefresh from "eslint-plugin-react-refresh";

const __dirname = import.meta.dirname;

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintReactRecommended,
  eslintReactJsxRuntime,
  // This needs to in a separate object to be a "global ignore". See https://github.com/eslint/eslint/discussions/17429
  { ignores: ["dist"] },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
      reactHooks: eslintPluginReactHooks,
      reactRefresh: eslintPluginReactRefresh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Following changes similar to https://github.com/shadcn-ui/ui/issues/1534#issue-1899453318 because shadcn/ui doesn't respect this rule
      "react-refresh/only-export-components": [
        "off",
        { allowConstantExport: true },
      ],
      // Too much spam when we don't use variables when overriding methods in classes.
      // Also see https://www.totaltypescript.com/tsconfig-cheat-sheet
      "@typescript-eslint/no-unused-vars": "off",
      // Disable prop-types rule since we use TS. This does disable runtime prop checks
      // We do this to prevent errors in some shadcn/ui components e.g. `error  'className' is missing in props validation`
      // Code taken from https://github.com/shadcn-ui/ui/issues/120#issuecomment-1828081539
      "react/prop-types": "off",
    },
    // Alternative approach to avoid shadcn/ui prop types eslint errors (but needs hardcoding of specific props)
    // overrides: [
    //   {
    //     files: ["**/components/ui/*.tsx"],
    //     rules: {
    //       "react/prop-types": [2, { ignore: ["className", "sideOffset"] }],
    //       "react-refresh/only-export-components": "off",
    //     },
    //   },
    // ],
  },
);
