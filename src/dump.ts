import { FormatError } from "./parse";
import { RubyClass, RubyClassOrModule, RubyHash, RubyModule, RubyObject, RubyStruct } from "./ruby";
import { BignumSign, RegexpOption, Type } from "./types";
import { ArrayBufferBuilder, concatArrayBuffers } from "./utils";

function dumpFixnum(builder: ArrayBufferBuilder, value: number) {
  if (value === 0) {
    builder.appendArray([0]);
  } else if (value > 0 && value + 5 <= 0x80) {
    builder.appendArray([value + 5]);
  } else if (value < 0 && value - 5 >= -0x7f) {
    builder.appendArray([value - 5]);
  } else {
    // non-optimize: just store 4 bytes
    builder.appendArray([
      value < 0 ? -4 : 4,
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff,
    ]);
  }
}

let encoder: TextEncoder | undefined;

function dumpString(builder: ArrayBufferBuilder, string: string) {
  dumpFixnum(builder, (encoder ||= new TextEncoder()).encode(string).byteLength);
  builder.appendString(string);
}

function dumpPairs(builder: ArrayBufferBuilder, pairs: [any, any][]) {
  dumpFixnum(builder, pairs.length);
  for (const [key, value] of pairs) {
    dumpAny(builder, key);
    dumpAny(builder, value);
  }
}

function dumpAny(builder: ArrayBufferBuilder, value: any): ArrayBuffer {
  encoder ||= new TextEncoder();
  if (value === true) {
    builder.appendString(Type.TRUE);
  } else if (value === false) {
    builder.appendString(Type.FALSE);
  } else if (value === null) {
    builder.appendString(Type.NIL);
  } else if (Number.isInteger(value)) {
    if (-0x40000000 <= value && value <= 0xffffffff) {
      builder.appendString(Type.FIXNUM);
      dumpFixnum(builder, value);
    } else {
      builder.appendString(Type.BIGNUM);
      const sign = value < 0 ? BignumSign.NEGATIVE : BignumSign.POSITIVE;
      const bytes: number[] = [];
      value = Math.abs(value);
      do {
        bytes.push(value % 256);
        value = Math.floor(value / 256);
      } while (value);
      if (bytes.length % 2 === 1) bytes.push(0);
      builder.appendArray([sign]);
      dumpFixnum(builder, bytes.length >> 1);
      builder.appendArray(bytes);
    }
  } else if (typeof value === "symbol") {
    // non-optimize: no symbol-ref
    builder.appendString(Type.SYMBOL);
    dumpString(builder, Symbol.keyFor(value)!);
  } else if (value instanceof RubyObject) {
    if (value.data) {
      builder.appendString(Type.DATA);
      dumpAny(builder, value.data);
    } else if (value.wrapped) {
      builder.appendString(Type.USER_CLASS);
      dumpAny(builder, value.wrapped);
    } else if (value.userDefined) {
      builder.appendString(Type.USER_DEFINED);
      dumpFixnum(builder, value.userDefined.byteLength);
      builder.appendArray(new Uint8Array(value.userDefined));
    } else if (value.userMarshal) {
      builder.appendString(Type.USER_MARSHAL);
      dumpAny(builder, value.userMarshal);
    } else if (value.extends) {
      builder.appendString(Type.EXTEND);
      dumpAny(builder, value.extends);
    } else {
      builder.appendString(Type.OBJECT);
      dumpAny(builder, value.className);
      dumpPairs(builder, value.instanceVariables);
    }
  } else if (Array.isArray(value)) {
    builder.appendString(Type.ARRAY);
    dumpFixnum(builder, value.length);
    for (const item of value) {
      dumpAny(builder, item);
    }
  } else if (value instanceof RubyClass) {
    builder.appendString(Type.CLASS);
    dumpString(builder, value.name);
  } else if (value instanceof RubyModule) {
    builder.appendString(Type.MODULE);
    dumpString(builder, value.name);
  } else if (value instanceof RubyClassOrModule) {
    builder.appendString(Type.CLASS_OR_MODULE);
    dumpString(builder, value.name);
  } else if (typeof value === "number") {
    builder.appendString(Type.FLOAT);
    if (Number.isNaN(value)) {
      dumpString(builder, "nan");
    } else if (value === Number.POSITIVE_INFINITY) {
      dumpString(builder, "inf");
    } else if (value === Number.NEGATIVE_INFINITY) {
      dumpString(builder, "-inf");
    } else {
      dumpString(builder, value.toString());
    }
  } else if (value instanceof RubyHash) {
    if (value.defaultValue === undefined) {
      builder.appendString(Type.HASH);
      dumpPairs(builder, value.pairs);
    } else {
      builder.appendString(Type.HASH_WITH_DEFAULT_VALUE);
      dumpPairs(builder, value.pairs);
      dumpAny(builder, value.defaultValue);
    }
  } else if (value instanceof RegExp) {
    builder.appendString(Type.REGEXP);
    dumpString(builder, value.source);
    let flag = 0;
    if (value.ignoreCase) flag |= RegexpOption.IGNORECASE;
    if (value.multiline) flag |= RegexpOption.MULTILINE;
    builder.appendArray([flag]);
  } else if (typeof value === "string") {
    builder.appendString(Type.STRING);
    dumpString(builder, value);
  } else if (value instanceof RubyStruct) {
    builder.appendString(Type.STRUCT);
    dumpAny(builder, value.className);
    dumpPairs(builder, value.pairs);
  } else {
    throw new FormatError(`unsupported type of dump value`);
  }
  return builder.buffer;
}

export function dump(value: any): ArrayBuffer {
  const builder = new ArrayBufferBuilder();
  builder.appendArray([4, 8]);
  return dumpAny(builder, value);
}

export function dumpAll(values: any[]) {
  return concatArrayBuffers(...values.map(dump));
}
