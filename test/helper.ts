import cp from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { suite, Test } from "uvu";

export function describe(title: string, callback: (test: Test) => void) {
  const test = suite(title);
  callback(test);
  test.run();
}

/**
 * @example
 * rubyEval(`p 1`) => '1'
 */
export async function rubyEval(code: string) {
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
 * @example
 * rubyMarshalDump(`nil`) => ArrayBuffer { 4, 8, 0x30 }
 */
export async function rubyMarshalDump(code: string) {
  const stdout = await rubyEval(`s = Marshal.dump begin ${code} end; p s.unpack 'C*'`);
  return Uint8Array.from(new Function(`return ${stdout}`)() as number[]).buffer;
}

/**
 * @example
 * rubyMarshalLoad(marshal.dump(null)) => 'nil'
 */
export async function rubyMarshalLoad(buffer: ArrayBuffer, preamble = "", suffix = "p a") {
  const array = Array.from(new Uint8Array(buffer));
  let code = `a = Marshal.load [${array}].pack 'C*'`;
  if (preamble) code = preamble + "; " + code;
  if (suffix) code += "; " + suffix;
  return (await rubyEval(code)).trim();
}
