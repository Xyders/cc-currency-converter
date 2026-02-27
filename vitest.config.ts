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
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
      reporter: ["text", "html", "json"],
      exclude: ['prd/**'],
    },
  },
});