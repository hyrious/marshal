import isPlainObject from "is-plain-obj";
import { RE_IGNORECASE, RE_MULTILINE } from "./constants";
import { RubyBaseObject, RubyHash, RubyString } from "./ruby";

let decoder: TextDecoder | undefined;
export function decode(buffer: ArrayBuffer) {
  return (decoder ||= new TextDecoder()).decode(buffer);
}
let encoder: TextEncoder | undefined;
export function encode(string: string) {
  return (encoder ||= new TextEncoder()).encode(string);
}

// is the input js object can be dumped to a ruby string?
export function is_string(a: any): a is ArrayBuffer | string | RubyString {
  return typeof a === "string" || a instanceof ArrayBuffer || a instanceof RubyString;
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

// is the input js object can be dumped to a ruby hash?
export function is_hash(a: any): a is Record<string, any> | Map<any, any> | RubyHash {
  return a instanceof Map || a instanceof RubyHash || isPlainObject(a);
}

export function has_ivar(a: RubyBaseObject) {
  return a.instanceVariables && a.instanceVariables.length > 0;
}
