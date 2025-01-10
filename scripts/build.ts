import fs from "fs";
import * as rollup from "rollup";
import * as esbuild from "esbuild";
import * as dts from "@hyrious/dts";
import prettyBytes from "pretty-bytes";

fs.rmSync("dist", { recursive: true, force: true });

const rollup_esbuild_plugin: rollup.Plugin = {
  name: "esbuild",
  async load(id) {
    const { outputFiles } = await esbuild.build({
      entryPoints: [id],
      bundle: true,
      format: "esm",
      outfile: id.replace(/\.ts$/, ".js"),
      write: false,
      target: ["node14.18", "node16"],
      platform: "node",
      minify: true,
      mangleProps: /[^_]_$/,
      sourcemap: true,
      sourcesContent: false,
    });
    let code!: string, map!: string;
    for (const { path, text } of outputFiles) {
      if (path.endsWith(".map")) map = text;
      else code = text;
    }
    return { code, map };
  },
  async renderChunk(code, chunk, options) {
    const result = await esbuild.transform(code, { minify: true, sourcemap: true });
    return { code: result.code, map: result.map };
  },
};

let start = Date.now();
let bundle = await rollup.rollup({
  input: "src/index.ts",
  plugins: [rollup_esbuild_plugin],
});

let esm = bundle.write({
  file: "dist/marshal.mjs",
  format: "esm",
  sourcemap: true,
  sourcemapExcludeSources: true,
});

let cjs = bundle.write({
  file: "dist/marshal.js",
  format: "cjs",
  sourcemap: true,
  sourcemapExcludeSources: true,
});

let iife = bundle.write({
  file: "dist/marshal.iife.js",
  format: "iife",
  name: "marshal",
  sourcemap: true,
});

let esm_ = await esm;
let cjs_ = await cjs;
let iife_ = await iife;
await bundle.close();
console.log("Built dist/marshal.{js,mjs,iife.js} in", Date.now() - start, "ms");

const print = (banner: string, o: rollup.RollupOutput) => {
  console.log(`  ${banner}: ${prettyBytes(o.output[0].code.length)}`);
};
print(" esm", esm_);
print(" cjs", cjs_);
print("iife", iife_);

start = Date.now();
await dts.build({ entryPoints: { marshal: "src/index.ts" } });
fs.cpSync("dist/marshal.d.ts", "dist/marshal.d.mts");
console.log("Built dist/marshal.d.ts in", Date.now() - start, "ms");
