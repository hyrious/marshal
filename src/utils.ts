import type { RubyBaseObject, RubyString } from "./ruby";

import { RE_IGNORECASE, RE_MULTILINE } from "./constants";

let decoder: TextDecoder | undefined;
export function decode(buffer: ArrayBuffer) {
  return (decoder ||= new TextDecoder()).decode(buffer);
}
let encoder: TextEncoder | undefined;
export function encode(string: string) {
  return (encoder ||= new TextEncoder()).encode(string);
}

export function string_to_buffer(a: ArrayBuffer | string | RubyString) {
  if (a instanceof ArrayBuffer) return a;
  if (typeof a === "string") return encode(a);
  return a.buffer;
}

export function flags_to_uint8(f: string) {
  let i = 0;
  if (f.includes("i")) i |= RE_IGNORECASE;
  if (f.includes("m")) i |= RE_MULTILINE;
  return i;
}

export function has_ivar(a: RubyBaseObject) {
  return a.instanceVariables && a.instanceVariables.length > 0;
}

export function hash_set(object: Record<string, any>, key: any, value: any) {
  let str: string | undefined;
  if (typeof key === "symbol" && (str = Symbol.keyFor(key))) {
    object[str] = value;
  } else if (typeof key === "string") {
    object[key] = value;
  } else {
    throw new TypeError("RubyHash.toJS(): only support string or symbol keys");
  }
}
