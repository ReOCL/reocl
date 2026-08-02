import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

const here = import.meta.dirname;

export default defineConfig({
  base: "./",
  plugins: [preact(), viteSingleFile()],
  resolve: {
    dedupe: ["preact", "@preact/signals", "@preact/signals-core"],
    alias: {
      "@": path.resolve(here, "src"),
      "@core": path.resolve(here, "../reactiveocl/src/core"),
      "@api": path.resolve(here, "../reactiveocl/src/api"),
    },
  },
});
