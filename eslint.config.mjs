import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// The mock API and its datasets are reached over HTTP only. Importing them
// would pull tens of MB of JSON into server or browser bundles.
const NO_MOCK_API = {
  group: ["**/mock-api", "**/mock-api/**"],
  message: "Access the mock API over HTTP via the BFF; never import it.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_MOCK_API] }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Layers: shared code (widgets, the data layer, plain helpers, the server)
    // never depends on a product feature; features build on them.
    files: ["src/ui/**", "src/data/**", "src/lib/**", "src/hooks/**", "src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            NO_MOCK_API,
            {
              group: ["@/features/*", "@/features/**"],
              message: "Shared code must not depend on a feature; move the shared part out of the feature instead.",
            },
          ],
        },
      ],
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
