import { Plugin } from "esbuild";
import { readFile } from "fs/promises";

export function constants(): Plugin {
  let cache: string | undefined;

  return {
    name: "constants",
    setup({ onLoad }) {
      onLoad({ filter: /\bconstants\.ts$/ }, async args => {
        if (!cache) {
          cache = await readFile(args.path, "utf-8");
          cache = cache.replace(/= ['"](.)['"].charCodeAt\(0\)/g, (_, $1) => "= " + $1.charCodeAt(0));
        }
        return { contents: cache, loader: "default" };
      });
    },
  };
}

export default constants;
