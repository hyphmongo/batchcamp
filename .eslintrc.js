/* eslint-env node */
module.exports = {
  env: {
    node: true,
    es2021: true,
    webextensions: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "neverthrow"],
  rules: {},
  settings: {
    react: {
      version: "detect",
    },
  },
};
