import { defineConfig } from "vite";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/index.ts", "src/types.ts"],
    },
  },
});
