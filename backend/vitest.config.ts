import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
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
          "@eve/gateway",
        ],
      },
    },
  },
});
