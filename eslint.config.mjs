import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // User-generated content is rendered as plain text only (BR-26, SR-12).
      "react/no-danger": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**"]),
]);
