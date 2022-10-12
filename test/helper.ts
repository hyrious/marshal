import cp from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { suite, Test } from "uvu";
import { load, dump, ParseOptions } from "../src/index";

export function describe(title: string, callback: (test: Test) => void) {
  const test = suite(title);
  callback(test);
  test.run();
}

/**
 * ```js
 * rb_eval(`p 1`) => '1'
 * ```
 */
export async function rb_eval(code: string) {
  const file = path.join(os.tmpdir(), `${Math.random().toString(36).slice(2)}.rb`);
  await fs.promises.writeFile(file, code);
  const output = await new Promise<string>((resolve, reject) =>
    cp.exec(`ruby ${JSON.stringify(file)}`, (err, stdout, stderr) => {
      err ? reject(err) : stderr ? reject(new Error(stderr)) : resolve(stdout);
    })
  );
  await fs.promises.unlink(file);
  return output;
}

/**
 * ```js
 * rb_dump(`nil`) => ArrayBuffer { 4, 8, 0x30 }
 * ```
 */
export async function rb_dump(code: string): Promise<ArrayBuffer> {
  const hex = await rb_eval(`s = Marshal.dump begin ${code} end; print s.unpack1 'H*'`);
  return new Uint8Array(Buffer.from(hex, "hex")).buffer;
}

export function loads(code: string, options?: ParseOptions) {
  return rb_dump(code).then(e => load(e, options));
}

/**
 * ```js
 * rb_load(marshal.dump(null)) => 'nil'
 * ```
 */
export async function rb_load(buffer: ArrayBuffer, preamble = "", inspect = "p a"): Promise<string> {
  const array = Array.from(new Uint8Array(buffer));
  let code = `a = Marshal.load [${array}].pack 'C*'`;
  if (preamble) code = preamble + "; " + code;
  if (inspect) code += "; " + inspect;
  return (await rb_eval(code)).trim();
}

export function dumps(x: any, preamble?: string, inspect?: string) {
  return rb_load(dump(x), preamble, inspect);
}

export function dump_a(x: any) {
  return Array.from(new Uint8Array(dump(x)));
}
