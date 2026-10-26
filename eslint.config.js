import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "error",
      eqeqeq: "error",
      curly: ["error", "all"],
      "no-var": "error",
    },
  },
];
