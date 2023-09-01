import isPlainObject from "is-plain-obj";
import { RE_EXTEND, RE_IGNORECASE, RE_MULTILINE } from "./constants";
import {
  HashLike,
  RubyExtends,
  RubyHash,
  RubyHashDefault,
  RubyIVars,
  RubyString,
  RubySymbol,
  isStringLike,
  isSymbolLike,
} from "./ruby";

export function str_to_option(f: string): number {
  var i = 0;
  if (f.includes("i")) i |= RE_IGNORECASE;
  if (f.includes("m")) i |= RE_MULTILINE;
  return i;
}

export function option_to_str(f: number, ruby?: boolean): string {
  var s = "";
  if (f & RE_IGNORECASE) s += "i";
  if (f & RE_EXTEND && ruby) s += "x";
  if (f & RE_MULTILINE) s += "m";
  return s;
}

export function str_to_float(text: string): number {
  return text === "inf" ? 1 / 0 : text === "-inf" ? -1 / 0 : text === "nan" ? NaN : Number(text);
}

export function decode_bignum(sign: number, bytes: Uint8Array): number {
  let a = 0;
  for (let i = 0; i < bytes.byteLength; ++i) {
    a += bytes[i] * 2 ** (i * 8);
  }
  return sign > 0 ? a : -a;
}

// UTF-8 only, other charsets are not supported
var decoder: TextDecoder | undefined;
export function decodeUTF8(buffer: Uint8Array | ArrayBuffer): string {
  return (decoder ||= new TextDecoder()).decode(buffer);
}

var encoder: TextEncoder | undefined;
export function encodeUTF8(string: string): Uint8Array {
  return (encoder ||= new TextEncoder()).encode(string);
}

export function extmod<T = any>(a: T, mods: (symbol | RubySymbol)[]): T & RubyExtends {
  if (a !== null && typeof a === "object" && mods.length > 0) {
    if (!(a as RubyExtends).__extends) {
      Object.defineProperty(a, "__extends", { value: [], configurable: true });
    }
    (a as RubyExtends).__extends!.push(...mods);
  }
  return a as T & RubyExtends;
}

export function ivars<T = any>(a: T, vars: [symbol | RubySymbol, any][]): T & RubyIVars {
  if (a !== null && typeof a === "object" && vars.length > 0) {
    if (!(a as RubyIVars).__ivars) {
      Object.defineProperty(a, "__ivars", { value: [], configurable: true });
    }
    (a as RubyIVars).__ivars!.push(...vars);
  }
  return a as T & RubyIVars;
}

export function has_ivar(a: any): boolean {
  return a !== null && typeof a === "object" && !!(a as RubyIVars).__ivars;
}

export function hash_default<T = any>(a: T, value: any): T & RubyHashDefault {
  if (a !== null && typeof a === "object") {
    Object.defineProperty(a, "__default", { value, configurable: true });
  }
  return a as T & RubyIVars;
}

export function hash_set(object: Record<string, any>, key: any, value: any) {
  if (isSymbolLike(key)) {
    object[symbol_to_str(key)] = value;
  } else if (typeof key === "string" || typeof key === "number") {
    object[key] = value;
  } else if (isStringLike(key)) {
    object[(key as RubyString).value] = value;
  } else {
    throw new TypeError("hash to js only support string or symbol or number keys");
  }
}

export function symbol_to_str(a: symbol | RubySymbol): string {
  return typeof a === "symbol" ? Symbol.keyFor(a)! : a.source;
}

export function hash_of(a: HashLike): RubyHash {
  if (isPlainObject(a) && a.type === "hash") return a as unknown as RubyHash;

  const hash: RubyHash = { type: "hash", entries: [], default: void 0 };
  if (Object.prototype.toString.call(a) === "[object Map]")
    for (const [key, value] of a as Map<any, any>) {
      hash.entries.push([key, value]);
    }
  else
    for (const key of Object.keys(a)) {
      hash.entries.push([Symbol.for(key), (a as any)[key]]);
    }
  if ((a as RubyHashDefault).__default !== void 0) {
    hash.default = (a as RubyHashDefault).__default;
  }

  return hash;
}
