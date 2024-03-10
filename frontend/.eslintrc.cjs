module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:@typescript-eslint/stylistic",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
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
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json", "./tsconfig.node.json"],
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: {
      version: "detect",
    },
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
};
