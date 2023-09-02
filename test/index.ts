import { Suite } from "uvu/parse";
import { readdirSync } from "fs";
import { build } from "esbuild";
import { join } from "path";

const ignored = ["index.ts", "helper.ts"];
const suites: Suite[] = [];
const pattern = (() => {
  let p = process.argv[2];
  return p ? new RegExp(p, "i") : /\.ts$/;
})();

readdirSync(__dirname).forEach(name => {
  if (ignored.includes(name)) return;
  if (pattern.test(name)) suites.push({ name, file: join(__dirname, name) });
});
suites.sort((a, b) => a.name.localeCompare(b.name));

const outfile = "./node_modules/.cache/test.mjs";
await build({
  stdin: {
    contents: suites.map(e => `import ${JSON.stringify("./" + e.name)}`).join("\n"),
    resolveDir: __dirname,
  },
  bundle: true,
  format: "esm",
  platform: "node",
  external: ["uvu/*"],
  outfile,
}).catch(() => process.exit(1));

await import(join(process.cwd(), outfile));
