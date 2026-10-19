import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // The mock API and its datasets are reached over HTTP only. Importing them
      // would pull tens of MB of JSON into server or browser bundles.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mock-api", "**/mock-api/**"],
              message: "Access the mock API over HTTP via the BFF; never import it.",
            },
          ],
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "mock-api/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
