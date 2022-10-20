import { dump } from "./dump";
import { load, ParseOptions } from "./parse";

export * from "./dump";
export * from "./parse";
export * from "./ruby";

export function clone<T = any>(obj: T, options?: ParseOptions): T {
  return load(dump(obj), options);
}
