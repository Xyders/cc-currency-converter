import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersProject({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        miniflare: {
          serviceBindings: {},
        },
        wrangler: {
          configPath: "./wrangler.test.toml",
        },
      },
    },
    coverage: {
      provider: "istanbul",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ["text", "html", "json"],
    },
  },
});