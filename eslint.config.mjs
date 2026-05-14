import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "examples/**",
      "design_handoff_aios_redesign/**",
      "next-env.d.ts",
      "*.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // React 19 introduces these; the codebase uses several set-state-in-effect
      // patterns for legit external-state syncing (timer, fetcher, mount-gating
      // overlays). Downgrade to warn for the launch and refactor incrementally.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
];
