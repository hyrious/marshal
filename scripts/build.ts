import fs from "node:fs";
import * as rollup from "rollup";
import * as esbuild from "esbuild";
import * as dts from "@hyrious/dts";
import { name } from "../package.json";
import mangleCache from "../mangle-cache.json";
import constants from "./plugins/constants";

fs.rmSync("dist", { recursive: true, force: true });

const rollup_esbuild_plugin = (minify = false): rollup.Plugin => ({
  name: "esbuild",
  async load(id) {
    const { outputFiles } = await esbuild.build({
      entryPoints: [id],
      bundle: true,
      format: "esm",
      outfile: id.replace(/\.ts$/, ".js"),
      write: false,
      target: ["node14.18", "node16"],
      plugins: [constants()],
      platform: "node",
      minify,
      mangleProps: /[^_]_$/,
      mangleCache,
      sourcemap: true,
    });
    let code!: string, map!: string;
    for (const { path, text } of outputFiles) {
      if (path.endsWith(".map")) map = text;
      else code = text;
    }
    return { code, map };
  },
  async renderChunk(code, chunk, options) {
    if (!minify) {
      code = code.replace(/^var ((?:T|RE|B)_[_A-Z]+ = \d+;)/gm, "const $1");
      return { code, map: null };
    }
    const result = await esbuild.transform(code, { minify: true, sourcemap: true });
    return { code: result.code, map: result.map };
  },
});

let start = Date.now();
let bundle = await rollup.rollup({
  input: "src/index.ts",
  plugins: [rollup_esbuild_plugin()],
});

const esm = bundle.write({
  file: "dist/index.mjs",
  format: "es",
  sourcemap: true,
  sourcemapExcludeSources: true,
});

const cjs = bundle.write({
  file: "dist/index.js",
  format: "cjs",
  sourcemap: true,
  sourcemapExcludeSources: true,
});

const iife = rollup
  .rollup({
    input: "src/index.ts",
    plugins: [rollup_esbuild_plugin(true)],
  })
  .then(bundle =>
    bundle.write({
      file: "dist/index.iife.js",
      format: "iife",
      name: name.split("/").pop(),
      sourcemap: true,
    })
  );

await esm;
await cjs;
await iife;
await bundle.close();
console.log("Built dist/index.{js,mjs,iife.js} in", Date.now() - start, "ms");

start = Date.now();
await dts.build("src/index.ts", "dist/index.d.ts");
console.log("Built dist/index.d.ts in", Date.now() - start, "ms");
