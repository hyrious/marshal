import cp from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { suite, Test } from "uvu";

const tests: Test<unknown>[] = [];

export function describe<T = any>(title: string, callback: (test: Test<T>) => void) {
  const test = suite<T>(title);
  callback(test);
  tests.push(test);
}

export function runTests() {
  tests.forEach(t => t.run());
}

/**
 * ```js
 * rb_eval("p 1") => "1\n"
 * ```
 */
export async function rb_eval(code: string): Promise<string> {
  const file = path.join(os.tmpdir(), `${Math.random().toString(36).slice(2)}.rb`);
  await fs.promises.writeFile(file, code);
  const output = await new Promise<string>((resolve, reject) =>
    cp.exec(`ruby ${JSON.stringify(file)}`, (err, stdout, stderr) =>
      err ? reject(err) : stderr ? reject(new Error(stderr)) : resolve(stdout),
    ),
  );
  await fs.promises.unlink(file);
  return output;
}

/**
 * ```js
 * rb_dump("nil") => Uint8Array [4, 8, 48]
 * ```
 */
export async function rb_dump(code: string): Promise<Uint8Array> {
  const hex = await rb_eval(`s = Marshal.dump begin ${code} end; print s.unpack1 'H*'`);
  return Buffer.from(hex, "hex");
}

/**
 * ```js
 * rb_load(Uint8Array [4, 8, 48]) => "nil"
 * ```
 */
export async function rb_load(data: Uint8Array, pre = "", post = "print a.inspect"): Promise<string> {
  const hex = Buffer.from(data).toString("hex");
  let code = `a = Marshal.load ['${hex}'].pack("H*")`;
  if (pre) code = pre + "; " + code;
  if (post) code += "; " + post;
  return rb_eval(code);
}

/**
 * ```js
 * rb_str`"\a"` => "\x07" (instead of "a")
 * ```
 */
export async function rb_str({ raw }: TemplateStringsArray): Promise<string> {
  const hex = await rb_eval(`print ${raw}.unpack1 'H*'`);
  return Buffer.from(hex, "hex").toString();
}
