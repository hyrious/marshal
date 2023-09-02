import { readFile } from "fs/promises";
import { Plugin } from "esbuild";

const plugin: Plugin = {
  name: "constants",
  setup({ onLoad }) {
    let cache: string | undefined;
    onLoad({ filter: /\bconstants\.ts$/ }, async args => {
      if (!cache) {
        cache = await readFile(args.path, "utf-8");
        cache = cache.replace(/= ['"](.)['"].charCodeAt\(0\)/g, (_, $1) => "= " + $1.charCodeAt(0));
      }
      return { contents: cache, loader: "default" };
    });
  },
};

export default plugin;
