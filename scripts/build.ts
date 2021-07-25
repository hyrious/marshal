import { build, BuildOptions } from "esbuild";
import pkg from "../package.json";

const common: BuildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  sourcesContent: false,
  target: "node12",
};

build({
  ...common,
  outfile: pkg.jsdelivr,
  globalName: pkg.name.split("/").pop(),
});

build({
  ...common,
  outfile: pkg.module,
  format: "esm",
  target: "esnext",
});

build({
  ...common,
  outfile: pkg.main,
  format: "cjs",
});
