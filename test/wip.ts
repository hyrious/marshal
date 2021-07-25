import * as marshal from "../src";
import { ruby } from "./helper";

async function main() {
  let a: any[] = marshal.load(await ruby(`a = []; a << a; a`));
  console.log(a);
}

main().catch(() => process.exit(1));
