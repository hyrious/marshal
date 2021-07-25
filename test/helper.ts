import cp from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export async function ruby(code: string) {
  const file = path.join(os.tmpdir(), `${Math.random().toString(36).slice(2)}.rb`);
  await fs.promises.writeFile(file, `s = Marshal.dump begin ${code} end; p s.unpack 'C*'`);
  const stdout: string = await new Promise((resolve, reject) =>
    cp.exec(`ruby ${JSON.stringify(file)}`, (err, stdout, stderr) => {
      err ? reject(err) : stderr ? reject(new Error(stderr)) : resolve(stdout);
    })
  );
  await fs.promises.unlink(file);
  const array = new Function(`return ${stdout}`)() as number[];
  return Uint8Array.from(array).buffer;
}
