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
      // The secret-key client bypasses RLS (ARCHITECTURE §6.3).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "The admin (secret key) client is only allowed in src/server/payments/** and src/app/api/**.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/payments/**", "src/app/api/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**"]),
]);
