import * as marshal from "../src";
import { rubyMarshalLoad } from "./helper";

async function main() {
  let a: any[] = [];
  a.push(a);
  console.log("dump circular values are not supported yet");
  let b = marshal.dump(a);
  console.log(b);
  const s = await rubyMarshalLoad(b);
  console.log(s);
}

main().catch(() => process.exit(1));
