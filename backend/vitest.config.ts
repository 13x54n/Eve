import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["development"],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "dist/**",
        "**/*.config.ts",
        "**/*.d.ts",
        "**/generated/**",
        "load/**",
        "prisma/**",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 65,
        lines: 70,
      },
    },
    server: {
      deps: {
        inline: [
          "@eve/shared",
          "@eve/db",
          "@eve/http",
          "@eve/auth",
          "@eve/location",
          "@eve/ride",
          "@eve/notify",
          "@eve/admin",
          "@eve/grpc",
        ],
      },
    },
  },
});
