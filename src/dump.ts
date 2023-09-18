import isPlainObject from "is-plain-obj";

import * as constants from "./constants";
import { encode, symKeys } from "./internal";
import { RubyClass, RubyFloat, RubyHash, RubyInteger, RubyModule, RubyObject, RubyStruct } from "./ruby";
import { ClassLike } from "./load";

export interface DumpOptions {
  /**
   * If true, convert string keys in JS objects to ruby symbols in Hash.
   * ```js
   * dump({ a: 1 }) // => ruby: { "a" => 1 }
   * dump({ a: 1 }, { hashStringKeysToSymbol: true }) // => ruby: { :a => 1 }
   * ```
   */
  hashStringKeysToSymbol?: boolean;

  /**
   * If set, use this known classes to encode ruby objects.
   * ```js
   * dump(new A()) // => Error "can't dump object [object Object]"
   * dump(new A(), { known: { A } }) // => ruby: #<A>
   * ```
   */
  known?: { [klass: string]: ClassLike };

  /**
   * If set, use this string for unknown classes to encode ruby objects.
   * ```js
   * dump(new A()) // => Error "can't dump object [object Object]"
   * dump(new A(), { unknown: () => "A" }) // => ruby: #<A>
   * ```
   */
  unknown?: (obj: unknown) => string | null | undefined;
}

class Dumper {
  declare data_: Uint8Array;
  declare length_: number;
  declare objects_: Map<any, number>;
  declare symbols_: Map<symbol, number>;
  declare options_: DumpOptions;

  constructor(options: DumpOptions = {}) {
    this.data_ = new Uint8Array(16);
    this.length_ = 0;
    this.objects_ = new Map();
    this.symbols_ = new Map();
    this.options_ = options;
  }

  dump_(value: unknown) {
    w_byte(this, 4);
    w_byte(this, 8);
    w_object(this, value);
    this.objects_.clear();
    this.symbols_.clear();
    return this;
  }

  get_() {
    return this.data_.subarray(0, this.length_);
  }
}

const resize = (d: Dumper) => {
  var data = new Uint8Array(d.data_.byteLength << 1);
  data.set(d.data_);
  d.data_ = data;
};

const w_byte = (d: Dumper, b: number) => {
  if (d.length_ >= d.data_.byteLength) resize(d);
  d.data_[d.length_++] = b;
};

const w_buffer = (d: Dumper, arr: ArrayLike<number>) => {
  while (d.length_ + arr.length >= d.data_.byteLength) resize(d);
  d.data_.set(arr, d.length_);
  d.length_ += arr.length;
};

const w_bytes = (d: Dumper, arr: ArrayLike<number>) => {
  w_long(d, arr.length);
  w_buffer(d, arr);
};

const w_string = (d: Dumper, s: string) => {
  w_bytes(d, encode(s));
};

const w_long = (d: Dumper, n: number) => {
  var buf = new Uint8Array(5);
  var i = ruby_marshal_write_long(n, buf);
  w_buffer(d, buf.subarray(0, i));
};

const ruby_marshal_write_long = (x: number, buf: Uint8Array) => {
  if (x === 0) {
    buf[0] = 0;
    return 1;
  }
  if (0 < x && x < 123) {
    buf[0] = x + 5;
    return 1;
  }
  if (-124 < x && x < 0) {
    buf[0] = (x - 5) & 0xff;
    return 1;
  }
  for (var i = 1; i < 5; ++i) {
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
};

// prettier-ignore
const w_float = (d: Dumper, f: number) => {
  w_string(
    d,
    f !== f
      ? "nan"
      : Number.isFinite(f)
        ? (Object.is(f, -0) ? "-0" : f.toString())
        : f < 0 ? "-inf" : "inf"
  );
};

const w_symbol = (d: Dumper, sym: symbol) => {
  if (d.symbols_.has(sym)) {
    w_byte(d, constants.T_SYMLINK);
    w_long(d, d.symbols_.get(sym)!);
  } else {
    w_byte(d, constants.T_SYMBOL);
    w_bytes(d, encode(Symbol.keyFor(sym)!));
    d.symbols_.set(sym, d.symbols_.size);
  }
};

const w_extended = (d: Dumper, e: symbol[]) => {
  for (var sym of e) {
    w_byte(d, constants.T_EXTENDED);
    w_symbol(d, sym);
  }
};

const w_class = (d: Dumper, type: number, a: RubyObject | RubyStruct) => {
  if ((a as any)[constants.S_EXTENDS]) w_extended(d, (a as any)[constants.S_EXTENDS]);
  w_byte(d, type);
  w_symbol(d, a.class);
};

const w_uclass = (d: Dumper, a: RubyObject) => {
  if ((a as any)[constants.S_EXTENDS]) w_extended(d, (a as any)[constants.S_EXTENDS]);
  if (a.wrapped) {
    w_byte(d, constants.T_UCLASS);
    w_symbol(d, a.class);
  }
};

// also used for struct.members, both printing sym keys
const w_ivar = (d: Dumper, a: {}) => {
  // prettier-ignore
  var keys = symKeys(a), n = keys.length, i, k;
  if (n > 0) {
    w_long(d, n);
    for (i = 0; i < n; ++i) {
      w_symbol(d, (k = keys[i]));
      w_object(d, (a as any)[k]);
    }
  } else {
    w_long(d, 0);
  }
};

const w_bignum = (d: Dumper, a: number) => {
  w_byte(d, constants.T_BIGNUM);
  w_byte(d, a < 0 ? constants.B_NEGATIVE : constants.B_POSITIVE);
  var buffer: number[] = [];
  a = Math.abs(a);
  do {
    buffer.push(a & 0xff);
    a = Math.floor(a / 256);
  } while (a);
  if (buffer.length & 1) buffer.push(0);
  w_long(d, buffer.length >> 1);
  w_buffer(d, buffer);
};

const w_remember = (d: Dumper, obj: unknown) => {
  if (!d.objects_.has(obj)) {
    d.objects_.set(obj, d.objects_.size);
  }
};

const w_known = (d: Dumper, obj: {}, klass: string) => {
  w_remember(d, obj);
  if ((obj as any)[constants.S_EXTENDS]) w_extended(d, (obj as any)[constants.S_EXTENDS]);
  w_byte(d, constants.T_OBJECT);
  w_symbol(d, Symbol.for(klass));
  w_ivar(d, obj);
};

const w_object = (d: Dumper, obj: unknown) => {
  var str2sym = d.options_.hashStringKeysToSymbol;
  var known = d.options_.known || {};
  var unknown = d.options_.unknown;

  if (obj === void 0) {
    throw new TypeError("can't dump undefined");
  } else if (obj === null) {
    w_byte(d, constants.T_NIL);
  } else if (obj === true) {
    w_byte(d, constants.T_TRUE);
  } else if (obj === false) {
    w_byte(d, constants.T_FALSE);
  } else if (typeof obj === "number") {
    if (Number.isInteger(obj)) {
      if (-0x40000000 <= obj && obj < 0x40000000) {
        w_byte(d, constants.T_FIXNUM);
        w_long(d, obj);
      } else {
        w_remember(d, obj);
        w_bignum(d, obj);
      }
    } else {
      w_remember(d, obj);
      w_byte(d, constants.T_FLOAT);
      w_float(d, obj);
    }
  } else if (obj instanceof RubyInteger) {
    var i = obj.value;
    if (-0x40000000 <= i && i < 0x40000000) {
      w_byte(d, constants.T_FIXNUM);
      w_long(d, i);
    } else {
      w_remember(d, i);
      w_bignum(d, i);
    }
  } else if (obj instanceof RubyFloat) {
    var i = obj.value;
    w_remember(d, i);
    w_byte(d, constants.T_FLOAT);
    w_float(d, i);
  } else if (typeof obj === "symbol") {
    w_symbol(d, obj);
  } else if (d.objects_.has(obj)) {
    w_byte(d, constants.T_LINK);
    w_long(d, d.objects_.get(obj)!);
  } else if (obj instanceof RubyObject) {
    w_remember(d, obj);
    if (obj.data !== void 0) {
      w_class(d, constants.T_DATA, obj);
      w_object(d, obj.data);
    } else if (obj.wrapped !== void 0) {
      w_uclass(d, obj);
      w_object(d, obj.wrapped);
    } else if (obj.userDefined) {
      var has_ivar = symKeys(obj).length > 0;
      if (has_ivar) w_byte(d, constants.T_IVAR);
      w_class(d, constants.T_USERDEF, obj);
      w_bytes(d, obj.userDefined);
      if (has_ivar) w_ivar(d, obj);
    } else if (obj.userMarshal !== void 0) {
      w_class(d, constants.T_USERMARSHAL, obj);
      w_object(d, obj.userMarshal);
    } else {
      w_class(d, constants.T_OBJECT, obj);
      w_ivar(d, obj);
    }
  } else if (obj instanceof RubyStruct) {
    w_remember(d, obj);
    w_class(d, constants.T_STRUCT, obj);
    w_ivar(d, obj.members);
  } else if (Array.isArray(obj)) {
    w_remember(d, obj);
    w_byte(d, constants.T_ARRAY);
    w_long(d, obj.length);
    for (var i = 0; i < obj.length; ++i) {
      w_object(d, obj[i]);
    }
  } else if (obj instanceof RegExp) {
    w_remember(d, obj);
    w_byte(d, constants.T_REGEXP);
    w_string(d, obj.source);
    var options = 0;
    if (obj.flags.includes("i")) options |= constants.RE_IGNORECASE;
    if (obj.flags.includes("m")) options |= constants.RE_MULTILINE;
    w_byte(d, options);
  } else if (typeof obj === "string") {
    w_remember(d, obj);
    w_byte(d, constants.T_IVAR);
    w_byte(d, constants.T_STRING);
    w_string(d, obj);
    w_long(d, 1);
    w_symbol(d, constants._E);
    w_byte(d, constants.T_TRUE);
  } else if (obj instanceof Uint8Array) {
    w_remember(d, obj);
    w_byte(d, constants.T_STRING);
    w_bytes(d, obj);
  } else if (obj instanceof RubyClass) {
    w_remember(d, obj);
    w_byte(d, constants.T_CLASS);
    w_string(d, obj.name);
  } else if (obj instanceof RubyModule) {
    w_remember(d, obj);
    w_byte(d, obj.old ? constants.T_MODULE_OLD : constants.T_MODULE);
    w_string(d, obj.name);
  } else if (obj instanceof RubyHash) {
    w_remember(d, obj);
    var def = obj.default;
    w_byte(d, def === void 0 ? constants.T_HASH : constants.T_HASH_DEF);
    w_long(d, obj.entries.length);
    for (var i = 0, n = obj.entries.length, k, v; i < n; ++i) {
      [k, v] = obj.entries[i];
      w_object(d, k);
      w_object(d, v);
    }
    if (def !== void 0) w_object(d, def);
  } else if (obj instanceof Map) {
    w_remember(d, obj);
    var def = (obj as any)[constants.S_DEFAULT] as unknown;
    w_byte(d, def === void 0 ? constants.T_HASH : constants.T_HASH_DEF);
    w_long(d, obj.size);
    for (var [k, v] of obj) {
      w_object(d, k);
      w_object(d, v);
    }
    if (def !== void 0) w_object(d, def);
  } else if (isPlainObject(obj)) {
    w_remember(d, obj);
    var def = obj[constants.S_DEFAULT];
    w_byte(d, def === void 0 ? constants.T_HASH : constants.T_HASH_DEF);
    var keys = (Object.keys(obj) as (string | symbol)[]).concat(symKeys(obj));
    w_long(d, keys.length);
    for (var i = 0, n = keys.length, k; i < n; ++i) {
      k = keys[i];
      w_object(d, str2sym && typeof k === "string" ? Symbol.for(k) : k);
      w_object(d, obj[k]);
    }
    if (def !== void 0) w_object(d, def);
  } else {
    var proto = Object.getPrototypeOf(obj);
    for (var klass in known) {
      if (proto === known[klass].prototype) {
        w_known(d, obj, klass);
        return;
      }
    }
    if (unknown) {
      var s = unknown(obj);
      if (s) {
        w_known(d, obj, s);
        return;
      }
    }
    throw new TypeError("can't dump " + typeof obj + " " + obj);
  }
};

/**
 * Dump a value into marshal buffer.
 * ```js
 * dump(null) // => Uint8Array [ 4, 8, 48 ]
 * ```
 */
export function dump(value: unknown, options?: DumpOptions): Uint8Array {
  return new Dumper(options).dump_(value).get_();
}

export function dumpAll(value: unknown[], options?: DumpOptions): Uint8Array {
  var d = new Dumper(options);
  for (var i = 0; i < value.length; ++i) {
    d.dump_(value[i]);
  }
  return d.get_();
}
