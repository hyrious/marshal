import isPlainObject from "is-plain-obj";
import { decodeUTF8, decode_bignum, extmod, ivars, option_to_str, str_to_float } from "./utils";

interface RubyNode {
  type: string;
}

// extends and ivars are non-enumerable properties injected to the object
export interface RubyExtends {
  __extends?: (symbol | RubySymbol)[];
}

export function pushExtends(a: any, ...mods: (symbol | RubySymbol)[]): any {
  return extmod(a, mods);
}

export interface RubyIVars {
  __ivars?: [symbol | RubySymbol, any][];
}

export function pushIvars(a: any, ...vars: [symbol | RubySymbol, any][]): any {
  return ivars(a, vars);
}

export interface RubyString extends RubyNode {
  type: "string";
  contents: Uint8Array;
  readonly value: string;
}

export function makeString(contents: Uint8Array): RubyString {
  let text: string | null = null;
  return {
    type: "string",
    contents,
    get value() {
      const binary = this.contents;
      if (text === null || binary !== contents) {
        contents = binary;
        text = decodeUTF8(contents);
      }
      return text;
    },
  };
}

export function isStringLike(a: any): a is string | RubyString {
  return typeof a === "string" || (isPlainObject(a) && a.type === "string");
}

export interface RubySymbol extends RubyNode {
  type: "symbol";
  contents: Uint8Array;
  readonly value: symbol;
  readonly source: string;
}

export function makeSymbol(contents: Uint8Array): RubySymbol {
  let text: string | null = null;
  return {
    type: "symbol",
    contents,
    get source() {
      const binary = this.contents;
      if (text === null || binary !== contents) {
        contents = binary;
        text = decodeUTF8(contents);
      }
      return text;
    },
    get value() {
      return Symbol.for(this.source);
    },
  };
}

export function isSymbolLike(a: any): a is symbol | RubySymbol {
  return typeof a === "symbol" || (isPlainObject(a) && a.type === "symbol");
}

export interface RubyRegexp extends RubyNode {
  type: "regexp";
  contents: Uint8Array;
  readonly value: RegExp;
  readonly source: string;
  options: number;
  readonly flags: string;
}

export function makeRegexp(contents: Uint8Array, options: number): RubyRegexp {
  let text: string | null = null;
  let value: RegExp | null = null;
  return {
    type: "regexp",
    contents,
    get value() {
      if (value === null || this.contents !== contents || this.options !== options) {
        contents = this.contents;
        options = this.options;
        value = new RegExp(decodeUTF8(contents), option_to_str(options));
      }
      return value;
    },
    get source() {
      const binary = this.contents;
      if (text === null || binary !== contents) {
        contents = binary;
        text = decodeUTF8(contents);
      }
      return text;
    },
    options,
    get flags() {
      return option_to_str(this.options, true);
    },
  };
}

export function isRegexpLike(a: any): a is RegExp | RubyRegexp {
  return Object.prototype.toString.call(a) === "[object RegExp]" || (isPlainObject(a) && a.type === "regexp");
}

export interface RubyFixnum extends RubyNode {
  type: "fixnum";
  value: number;
  isInteger: true;
}

export function makeFixnum(value: number): RubyFixnum {
  return { type: "fixnum", value, isInteger: true };
}

export function isFixnumLike(a: any): a is number | RubyFixnum {
  return (
    (typeof a === "number" && (a | 0) === a && -0x40000000 <= a && a < 0x40000000) ||
    (isPlainObject(a) && a.type === "fixnum")
  );
}

export interface RubyFloat extends RubyNode {
  type: "float";
  readonly value: number;
  isInteger: false;
  text: string;
}

export function makeFloat(text: string): RubyFloat {
  let value: number | null = null;
  return {
    type: "float",
    get value() {
      if (value === null || this.text !== text) {
        text = this.text;
        value = str_to_float(text);
      }
      return value;
    },
    isInteger: false,
    text,
  };
}

export function isFloatLike(a: any): a is number | RubyFloat {
  return (typeof a === "number" && !Number.isInteger(a)) || (isPlainObject(a) && a.type === "float");
}

export interface RubyBignum extends RubyNode {
  type: "bignum";
  readonly value: number;
  isInteger: true;
  sign: -1 | 1;
  bytes: Uint8Array;
}

export function makeBignum(sign: -1 | 1, bytes: Uint8Array): RubyBignum {
  let value: number | null = null;
  return {
    type: "bignum",
    get value() {
      if (value === null || this.sign !== sign || this.bytes !== bytes) {
        sign = this.sign;
        bytes = this.bytes;
        value = decode_bignum(sign, bytes);
      }
      return value;
    },
    isInteger: true,
    sign,
    bytes,
  };
}

export function isBignumLike(a: any): a is number | bigint | RubyBignum {
  return (
    typeof a === "bigint" ||
    (typeof a === "number" && Number.isInteger(a) && !(-0x40000000 <= a && a < 0x40000000)) ||
    (isPlainObject(a) && a.type === "bignum")
  );
}

export type RubyNumeric = RubyFixnum | RubyBignum | RubyFloat;

export interface RubyArray extends RubyNode {
  type: "array";
  value: any[];
}

export function makeArray(value: any[]): RubyArray {
  return { type: "array", value };
}

export function isArrayLike(a: any): a is any[] | RubyArray {
  return Array.isArray(a) || (isPlainObject(a) && a.type === "array");
}

export interface RubyHash extends RubyNode {
  type: "hash";
  entries: [any, any][];
  default?: any;
}

export function makeHash(entries?: [any, any][], def?: any): RubyHash {
  return { type: "hash", entries: entries as [any, any][], default: def };
}

export type HashLike = Record<string | number | symbol, any> | Map<any, any> | RubyHash;

export function isHashLike(a: any): a is HashLike {
  return isPlainObject(a) || Object.prototype.toString.call(a) === "[object Map]";
}

export interface RubyHashDefault {
  __default?: any;
}

export interface RubyObject extends RubyNode {
  type: "object";
  class: symbol | RubySymbol;
}

export function makeObject(klass: symbol | RubySymbol): RubyObject {
  return { type: "object", class: klass };
}

export function isObjectLike(a: any): a is RubyObject {
  return isPlainObject(a) && a.type === "object";
}

export interface RubyData extends RubyNode {
  type: "data";
  class: symbol | RubySymbol;
  data: any;
}

export function makeData(klass: symbol | RubySymbol, data?: any) {
  return { type: "data", class: klass, data };
}

export function isDataLike(a: any): a is RubyData {
  return isPlainObject(a) && a.type === "data";
}

export interface RubyStruct extends RubyNode {
  type: "struct";
  class: symbol | RubySymbol;
  members: [symbol | RubySymbol, any][];
}

export function makeStruct(klass: symbol | RubySymbol, members?: [symbol | RubySymbol, any][]): RubyStruct {
  return { type: "struct", class: klass, members: members as [symbol | RubySymbol, any][] };
}

export function isStructLike(a: any): a is RubyStruct {
  return isPlainObject(a) && a.type === "struct";
}

export interface RubyWrapped extends RubyNode {
  type: "wrapped";
  class: symbol | RubySymbol;
  wrapped:
    | string
    | RubyString
    | RegExp
    | RubyRegexp
    | any[]
    | RubyArray
    | Record<string | number | symbol, any>
    | Map<any, any>
    | RubyHash;
}

export function makeWrapped(klass: symbol | RubySymbol, wrapped?: any): RubyWrapped {
  return { type: "wrapped", class: klass, wrapped };
}

export function isWrappedLike(a: any): a is RubyWrapped {
  return isPlainObject(a) && a.type === "wrapped";
}

export interface RubyUserDefined extends RubyNode {
  type: "user-defined";
  class: symbol | RubySymbol;
  contents: Uint8Array;
}

export function makeUserDefined(klass: symbol | RubySymbol, contents?: Uint8Array): RubyUserDefined {
  return { type: "user-defined", class: klass, contents: contents as Uint8Array };
}

export function isUserDefinedLike(a: any): a is RubyUserDefined {
  return isPlainObject(a) && a.type === "user-defined";
}

export interface RubyUserMarshal extends RubyNode {
  type: "user-marshal";
  class: symbol | RubySymbol;
  value: any;
}

export function makeUserMarshal(klass: symbol | RubySymbol, value?: any): RubyUserMarshal {
  return { type: "user-marshal", class: klass, value };
}

export function isUserMarshalLike(a: any): a is RubyUserMarshal {
  return isPlainObject(a) && a.type === "user-marshal";
}

export interface RubyClass extends RubyNode {
  type: "class";
  contents: Uint8Array;
  readonly name: string;
}

export function makeClass(contents: Uint8Array): RubyClass {
  let text: string | null = null;
  return {
    type: "class",
    contents,
    get name() {
      const binary = this.contents;
      if (text === null || binary !== contents) {
        contents = binary;
        text = decodeUTF8(contents);
      }
      return text;
    },
  };
}

export function isClassLike(a: any): a is Function | RubyClass {
  return (typeof a === "function" && a.name) || (isPlainObject(a) && a.type === "class");
}

export interface RubyModule extends RubyNode {
  type: "module";
  contents: Uint8Array;
  readonly name: string;
}

export function makeModule(contents: Uint8Array): RubyModule {
  const ret = makeClass(contents) as any;
  ret.type = "module";
  return ret;
}

export interface RubyClassOrModule extends RubyNode {
  type: "class-or-module";
  contents: Uint8Array;
  readonly name: string;
}

export function makeClassOrModule(contents: Uint8Array): RubyClassOrModule {
  const ret = makeClass(contents) as any;
  ret.type = "class-or-module";
  return ret;
}

export function isModuleLike(a: any): a is RubyModule | RubyClassOrModule {
  return isPlainObject(a) && (a.type === "module" || a.type === "class-or-module");
}
