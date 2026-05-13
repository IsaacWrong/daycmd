import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/config.ts",
        "src/lib/env-file.ts",
        "src/lib/hooks.ts",
        "src/lib/kb-schemas.ts",
        "src/lib/ls-migrate.ts",
        "src/lib/projects.ts",
        "src/lib/skills-defs.ts",
        "src/lib/tasks-parser.ts",
        "src/lib/tasks-writer.ts",
        "src/lib/template-tokens.ts",
        "src/components/redesign/TodFrame.tsx",
      ],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
