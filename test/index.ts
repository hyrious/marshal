import { readdirSync } from "fs";
import { join } from "path";
import { Suite } from "uvu/parse";
import { build } from "esbuild";

const ignores = ["index.ts", "helper.ts", "tsconfig.json"];
const suites: Suite[] = [];
const pattern = (() => {
  let p = process.argv[2];
  return p ? new RegExp(p, "i") : /\.ts$/;
})();

readdirSync(__dirname).forEach(str => {
  if (ignores.includes(str)) return;
  const name = str;
  const file = join(__dirname, str);
  if (pattern.test(name)) suites.push({ name, file });
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
