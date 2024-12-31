import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    minify: false
  },
  build: {
    minify: "terser",
    terserOptions: {
      mangle: {
        toplevel: true,
        module: true,
        properties: {
          regex: /^_/
        }
      },
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    target: "ES2020",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "lambdascript"
    },
    rollupOptions: {
      plugins: []
    }
  }
});
