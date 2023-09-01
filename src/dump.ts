import * as constants from "./constants";
import * as ruby from "./ruby";
import { encodeUTF8, has_ivar, hash_of, str_to_option } from "./utils";

export interface DumpOptions {
  /**
   * If set, instead of using the RubyObject wrapper, you can also use the given classes.
   */
  knownClasses?: Record<string, { readonly prototype: any }>;
}

/** This class holds the dump state (object ref, symbol ref) */
class Dumper {
  declare data_: Uint8Array;
  declare length_: number;
  declare objects_: Map<any, number>;
  declare symbols_: Map<symbol | ruby.RubySymbol, number>;
  declare options_: DumpOptions;

  constructor(options: DumpOptions = {}) {
    this.data_ = new Uint8Array(16);
    this.length_ = 0;
    this.objects_ = new Map();
    this.symbols_ = new Map();
    this.options_ = options;
  }

  get length() {
    return this.length_;
  }

  get data() {
    return this.data_.subarray(0, this.length_);
  }

  dump(value: any) {
    w_byte(this, 4);
    w_byte(this, 8);
    w_object(this, value);
    this.objects_.clear();
    this.symbols_.clear();
  }
}

function resize(d: Dumper) {
  const data = new Uint8Array(d.data_.byteLength << 1);
  data.set(d.data_);
  d.data_ = data;
}

function w_buffer(d: Dumper, arr: ArrayLike<number>) {
  while (d.length_ + arr.length >= d.data_.byteLength) resize(d);
  d.data_.set(arr, d.length_);
  d.length_ += arr.length;
}

function w_byte(d: Dumper, b: number) {
  if (d.length_ >= d.data_.byteLength) resize(d);
  d.data_[d.length_++] = b;
}

function w_bytes(d: Dumper, arr: ArrayLike<number>) {
  w_long(d, arr.length);
  w_buffer(d, arr);
}

function w_string(d: Dumper, s: string) {
  w_bytes(d, encodeUTF8(s));
}

function w_long(d: Dumper, n: number) {
  const buf = new Uint8Array(5);
  const i = ruby_marshal_write_long(n, buf);
  w_buffer(d, buf.subarray(0, i));
}

function ruby_marshal_write_long(x: number, buf: Uint8Array) {
  let i = 1;
  if (x === 0) {
    buf[0] = 0;
    return 1;
  }
  if (0 < x && x < 123) {
    buf[0] = x + 5;
    return 1;
  }
  if (-124 < x && x < 0) {
    buf[0] = (x - 5) & 0xff; // it wraps negative number to 0-255
    return 1;
  }
  for (i = 1; i < 5; ++i) {
    buf[i] = x & 0xff;
    x >>= 8;
    if (x === 0) {
      buf[0] = i;
      break;
    }
    if (x === -1) {
      buf[0] = -i;
      break;
    }
  }
  return i + 1;
}

function w_float(d: Dumper, f: number | ruby.RubyFloat) {
  if (typeof f !== "number") {
    w_string(d, f.text);
  } else if (Number.isNaN(f)) {
    w_string(d, "nan");
  } else if (!Number.isFinite(f)) {
    w_string(d, f < 0 ? "-inf" : "inf");
  } else if (f === 0) {
    w_string(d, Object.is(f, -0) ? "-0" : "0");
  } else {
    w_string(d, f.toString());
  }
}

function w_symbol(d: Dumper, sym: symbol | ruby.RubySymbol) {
  if (d.symbols_.has(sym)) {
    w_byte(d, constants.T_SYMLINK);
    w_long(d, d.symbols_.get(sym)!);
  } else {
    let name = typeof sym === "symbol" ? Symbol.keyFor(sym) : sym.contents;
    if (name === void 0) throw new TypeError("can't dump Symbol()");
    if (typeof name === "string") name = encodeUTF8(name);
    w_byte(d, constants.T_SYMBOL);
    w_bytes(d, name);
    d.symbols_.set(sym, d.symbols_.size);
  }
}

function w_extended(d: Dumper, extends_: (symbol | ruby.RubySymbol)[]) {
  for (const sym of extends_) {
    w_byte(d, constants.T_EXTENDED);
    w_symbol(d, sym);
  }
}

function w_class(d: Dumper, type: number, a: { class: symbol | ruby.RubySymbol }) {
  if ((a as ruby.RubyExtends).__extends) w_extended(d, (a as ruby.RubyExtends).__extends!);
  w_byte(d, type);
  w_symbol(d, a.class);
}

function w_uclass(d: Dumper, a: ruby.RubyWrapped) {
  if ((a as ruby.RubyExtends).__extends) w_extended(d, (a as ruby.RubyExtends).__extends!);
  if (a.wrapped) {
    w_byte(d, constants.T_UCLASS);
    w_symbol(d, a.class);
  }
}

function w_ivar(d: Dumper, a: {}) {
  if ((a as ruby.RubyIVars).__ivars) {
    w_long(d, (a as ruby.RubyIVars).__ivars!.length);
    for (const [key, value] of (a as ruby.RubyIVars).__ivars!) {
      w_symbol(d, key);
      w_object(d, value);
    }
  } else {
    w_long(d, 0);
  }
}

function w_bignum(d: Dumper, a: number | bigint | ruby.RubyBignum) {
  w_byte(d, constants.T_BIGNUM);
  if (typeof a === "number") {
    w_byte(d, a < 0 ? constants.B_NEGATIVE : constants.B_POSITIVE);
    const buffer: number[] = [];
    a = Math.abs(a);
    do {
      buffer.push(a & 0xff);
      a = Math.floor(a / 256);
    } while (a);
    if (buffer.length % 2) buffer.push(0);
    w_long(d, buffer.length >> 1);
    w_buffer(d, buffer);
  } else if (typeof a === "bigint") {
    w_byte(d, a < 0n ? constants.B_NEGATIVE : constants.B_POSITIVE);
    const buffer: number[] = [];
    a = a < 0n ? -a : a;
    do {
      buffer.push(Number(a & 0xffn));
      a >>= 8n;
    } while (a);
    if (buffer.length % 2) buffer.push(0);
    w_long(d, buffer.length >> 1);
    w_buffer(d, buffer);
  } else {
    w_byte(d, a.sign < 0 ? constants.B_NEGATIVE : constants.B_POSITIVE);
    w_long(d, a.bytes.byteLength >> 1);
    w_buffer(d, a.bytes);
  }
}

function w_remember(d: Dumper, obj: any) {
  if (!d.objects_.has(obj)) {
    d.objects_.set(obj, d.objects_.size);
  }
}

function w_object(d: Dumper, obj: any) {
  if (obj === void 0) {
    throw new TypeError("can't dump undefined");
  } else if (obj === null) {
    w_byte(d, constants.T_NIL);
  } else if (obj === true) {
    w_byte(d, constants.T_TRUE);
  } else if (obj === false) {
    w_byte(d, constants.T_FALSE);
  } else if (ruby.isFixnumLike(obj)) {
    w_byte(d, constants.T_FIXNUM);
    w_long(d, typeof obj === "number" ? obj : obj.value);
  } else if (ruby.isBignumLike(obj)) {
    w_remember(d, obj);
    w_bignum(d, obj);
  } else if (ruby.isFloatLike(obj)) {
    w_remember(d, obj);
    w_byte(d, constants.T_FLOAT);
    w_float(d, obj);
  } else if (ruby.isSymbolLike(obj)) {
    w_symbol(d, obj);
  } else if (d.objects_.has(obj)) {
    w_byte(d, constants.T_LINK);
    w_long(d, d.objects_.get(obj)!);
  } else if (ruby.isObjectLike(obj)) {
    w_remember(d, obj);
    w_class(d, constants.T_OBJECT, obj);
    w_ivar(d, obj);
  } else if (ruby.isDataLike(obj)) {
    w_remember(d, obj);
    w_class(d, constants.T_DATA, obj);
    w_object(d, obj.data);
  } else if (ruby.isWrappedLike(obj)) {
    w_remember(d, obj);
    w_uclass(d, obj);
    w_object(d, obj.wrapped);
  } else if (ruby.isUserDefinedLike(obj)) {
    w_remember(d, obj);
    if (has_ivar(obj)) w_byte(d, constants.T_IVAR);
    w_class(d, constants.T_USERDEF, obj);
    w_bytes(d, obj.contents);
    if (has_ivar(obj)) w_ivar(d, obj);
  } else if (ruby.isUserMarshalLike(obj)) {
    w_remember(d, obj);
    w_class(d, constants.T_USERMARSHAL, obj);
    w_object(d, obj.value);
  } else if (ruby.isArrayLike(obj)) {
    w_remember(d, obj);
    const array = Array.isArray(obj) ? obj : obj.value;
    w_byte(d, constants.T_ARRAY);
    w_long(d, array.length);
    for (const item of array) {
      w_object(d, item);
    }
  } else if (ruby.isClassLike(obj)) {
    w_remember(d, obj);
    w_byte(d, constants.T_CLASS);
    w_string(d, obj.name);
  } else if (ruby.isModuleLike(obj)) {
    w_remember(d, obj);
    w_byte(d, obj.type === "module" ? constants.T_MODULE : constants.T_MODULE_OLD);
    w_string(d, obj.name);
  } else if (ruby.isStructLike(obj)) {
    w_remember(d, obj);
    w_class(d, constants.T_STRUCT, obj);
    w_long(d, obj.members.length);
    for (const [key, value] of obj.members) {
      w_symbol(d, key);
      w_object(d, value);
    }
  } else if (ruby.isRegexpLike(obj)) {
    w_remember(d, obj);
    w_byte(d, constants.T_REGEXP);
    if (Object.prototype.toString.call(obj) === "[object RegExp]") {
      w_string(d, obj.source);
      w_byte(d, str_to_option(obj.flags));
    } else {
      w_buffer(d, (obj as ruby.RubyRegexp).contents);
      w_byte(d, (obj as ruby.RubyRegexp).options);
    }
  } else if (ruby.isStringLike(obj)) {
    w_remember(d, obj);
    w_byte(d, constants.T_STRING);
    if (typeof obj === "string") {
      w_bytes(d, encodeUTF8(obj));
    } else {
      w_bytes(d, obj.contents);
    }
  } else if (ruby.isHashLike(obj)) {
    w_remember(d, obj);
    const hash = hash_of(obj);
    w_byte(d, hash.default === undefined ? constants.T_HASH : constants.T_HASH_DEF);
    w_long(d, hash.entries.length);
    for (const [key, value] of hash.entries) {
      w_object(d, key);
      w_object(d, value);
    }
    if (hash.default !== undefined) w_object(d, hash.default);
  } else {
    const known = d.options_.knownClasses;
    for (const name in known) {
      if (Object.getPrototypeOf(obj) === known[name].prototype) {
        w_remember(d, obj);
        if ((obj as ruby.RubyExtends).__extends) w_extended(d, (obj as ruby.RubyExtends).__extends!);
        w_byte(d, constants.T_OBJECT);
        w_symbol(d, Symbol.for(name));
        w_ivar(d, obj);
        return;
      }
    }
    throw new TypeError("can't dump " + obj);
  }
}

export function dump(value: any, options?: DumpOptions): Uint8Array {
  const dumper = new Dumper(options);
  dumper.dump(value);
  return dumper.data;
}

export function dumpAll(values: any[], options?: DumpOptions): Uint8Array {
  const dumper = new Dumper(options);
  for (const value of values) {
    dumper.dump(value);
  }
  return dumper.data;
}
