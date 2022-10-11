import { defineConfig } from "tsup";
import { name } from "./package.json";
import { constants } from "./scripts/plugins/constants";
import mangleCache from "./mangle-cache.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm", "iife"],
  sourcemap: true,
  clean: true,
  platform: "browser",
  target: ["node14.18", "node16"],
  treeshake: true,
  globalName: name.split("/").pop(),
  minifySyntax: true,
  dts: true,
  esbuildPlugins: [constants()],
  esbuildOptions(options, { format }) {
    options.mangleProps = /[^_]_$/;
    options.mangleCache = mangleCache;
    if (format === "iife") options.minify = true;
  },
  outExtension({ format }) {
    if (format === "iife") return { js: ".iife.js" };
    if (format === "esm") return { js: ".mjs" };
    return { js: ".js" };
  },
});
