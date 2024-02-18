import { Suite } from "uvu/parse";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { runTests } from "./helper";

const ignored = ["index.ts", "helper.ts"];
const suites: Suite[] = [];
const pattern = (() => {
  let p = process.argv[2];
  return p ? new RegExp(p, "i") : /\.ts$/;
})();

const dir = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

readdirSync(dir).forEach(name => {
  if (ignored.includes(name)) return;
  if (pattern.test(name)) suites.push({ name, file: join(dir, name) });
});
suites.sort((a, b) => a.name.localeCompare(b.name));

for (const e of suites) {
  await import("./" + e.name);
}

runTests();
