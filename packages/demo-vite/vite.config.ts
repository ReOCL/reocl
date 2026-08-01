import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

// `import.meta.dirname` keeps the config loadable by Vite's native loader.
const here = import.meta.dirname;

export default defineConfig({
  base: "./",
  plugins: [preact(), viteSingleFile()],
  resolve: {
    // The library and the Preact binding must share one signal graph, so these
    // must never be bundled twice.
    dedupe: ["preact", "@preact/signals", "@preact/signals-core"],
    // Mirrors the `paths` of the tsconfigs: the library sources import its own
    // modules through these aliases, so Vite has to resolve them too.
    alias: {
      "@": path.resolve(here, "src"),
      "@core": path.resolve(here, "../reactiveocl/src/core"),
      "@api": path.resolve(here, "../reactiveocl/src/api"),
    },
  },
});
