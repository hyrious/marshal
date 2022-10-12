import * as constants from "./constants";
import * as ruby from "./ruby";
import { encode, flags_to_uint8, has_ivar, string_to_buffer } from "./utils";

/** This class holds the dump state (object ref, symbol ref) */
export class Dumper {
  declare data_: Uint8Array;
  declare length_: number;
  declare objects_: Map<any, number>;
  declare symbols_: Map<symbol, number>;

  constructor() {
    this.data_ = new Uint8Array(16);
    this.length_ = 0;
  }

  get length() {
    return this.length_;
  }

  get buffer() {
    return this.data_.buffer.slice(0, this.length_);
  }

  dump(value: any) {
    this.objects_ = new Map();
    this.symbols_ = new Map();
    w_byte(this, 4);
    w_byte(this, 8);
    w_object(this, value);
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
  w_bytes(d, encode(s));
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

function w_float(d: Dumper, f: number) {
  if (Number.isNaN(f)) {
    w_string(d, "nan");
  } else if (!Number.isFinite(f)) {
    w_string(d, f < 0 ? "-inf" : "inf");
  } else if (f === 0) {
    w_string(d, Object.is(f, -0) ? "-0" : "0");
  } else {
    w_string(d, f.toString());
  }
}

function w_symbol(d: Dumper, sym: symbol) {
  if (d.symbols_.has(sym)) {
    w_byte(d, constants.T_SYMLINK);
    w_long(d, d.symbols_.get(sym)!);
  } else {
    const name = Symbol.keyFor(sym);
    if (name === undefined) {
      throw new TypeError("can't dump Symbol()");
    }
    w_byte(d, constants.T_SYMBOL);
    w_bytes(d, encode(name));
    d.symbols_.set(sym, d.symbols_.size);
  }
}

function w_extended(d: Dumper, extends_: symbol[]) {
  extends_.forEach(sym => {
    w_byte(d, constants.T_EXTENDED);
    w_symbol(d, sym);
  });
}

function w_class(d: Dumper, type: number, a: ruby.RubyObject | ruby.RubyStruct) {
  if (a.extends) w_extended(d, a.extends);
  w_byte(d, type);
  w_symbol(d, a.className);
}

function w_uclass(d: Dumper, a: ruby.RubyObject) {
  if (a.extends) w_extended(d, a.extends);
  if (a.wrapped) {
    w_byte(d, constants.T_UCLASS);
    w_symbol(d, a.className);
  }
}

function w_ivar(d: Dumper, a: ruby.RubyBaseObject) {
  if (a.instanceVariables) {
    w_long(d, a.instanceVariables.length);
    a.instanceVariables.forEach(([key, value]) => {
      w_symbol(d, key);
      w_object(d, value);
    });
  } else {
    w_long(d, 0);
  }
}

function w_bignum(d: Dumper, a: number) {
  w_byte(d, constants.T_BIGNUM);
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
}

function w_remember(d: Dumper, obj: any) {
  if (!d.objects_.has(obj)) {
    d.objects_.set(obj, d.objects_.size);
  }
}

function w_object(d: Dumper, obj: any) {
  if (obj === null) {
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
  } else if (typeof obj === "symbol") {
    w_symbol(d, obj);
  } else if (d.objects_.has(obj)) {
    w_byte(d, constants.T_LINK);
    w_long(d, d.objects_.get(obj)!);
  } else if (obj instanceof ruby.RubyObject) {
    w_remember(d, obj);
    if (obj.data) {
      w_class(d, constants.T_DATA, obj);
      w_object(d, obj.data);
    } else if (obj.wrapped !== undefined) {
      w_uclass(d, obj);
      w_object(d, obj.wrapped);
    } else if (obj.userDefined) {
      if (has_ivar(obj)) w_byte(d, constants.T_IVAR);
      w_class(d, constants.T_USERDEF, obj);
      w_bytes(d, new Uint8Array(obj.userDefined));
      if (has_ivar(obj)) w_ivar(d, obj);
    } else if (obj.userMarshal) {
      w_class(d, constants.T_USERMARSHAL, obj);
      w_object(d, obj.userMarshal);
    } else {
      w_class(d, constants.T_OBJECT, obj);
      w_ivar(d, obj);
    }
  } else if (Array.isArray(obj)) {
    w_remember(d, obj);
    // not implemented user wrapped Array (i.e. an instance of class UserArray < Array)
    w_byte(d, constants.T_ARRAY);
    w_long(d, obj.length);
    obj.forEach(item => w_object(d, item));
  } else if (obj instanceof ruby.RubyClass) {
    w_remember(d, obj);
    w_byte(d, constants.T_CLASS);
    w_string(d, obj.name);
  } else if (obj instanceof ruby.RubyModule) {
    w_remember(d, obj);
    w_byte(d, constants.T_MODULE);
    w_string(d, obj.name);
  } else if (obj instanceof ruby.RubyClassOrModule) {
    w_remember(d, obj);
    w_byte(d, constants.T_MODULE_OLD);
    w_string(d, obj.name);
  } else if (obj instanceof ruby.RubyStruct) {
    w_remember(d, obj);
    w_class(d, constants.T_STRUCT, obj);
    w_long(d, obj.members.length);
    obj.members.forEach(([key, value]) => {
      w_symbol(d, key);
      w_object(d, value);
    });
  } else if (obj instanceof RegExp) {
    w_remember(d, obj);
    // not implemented user wrapped RegExp (i.e. an instance of class UserRegExp < RegExp)
    w_byte(d, constants.T_REGEXP);
    w_string(d, obj.source);
    w_byte(d, flags_to_uint8(obj.flags));
  } else if (ruby.RubyString.isString(obj)) {
    w_remember(d, obj);
    // not implemented instance variables and user wrapped string
    w_byte(d, constants.T_STRING);
    w_bytes(d, new Uint8Array(string_to_buffer(obj)));
  } else if (ruby.RubyHash.isHash(obj)) {
    w_remember(d, obj);
    // not implemented instance variables and user wrapped hash
    const hash = ruby.RubyHash.from(obj);
    w_byte(d, hash.defaultValue === undefined ? constants.T_HASH : constants.T_HASH_DEF);
    w_long(d, hash.entries.length);
    hash.entries.forEach(([key, value]) => {
      w_object(d, key);
      w_object(d, value);
    });
    if (hash.defaultValue !== undefined) w_object(d, hash.defaultValue);
  } else {
    throw new TypeError("can't dump " + obj);
  }
}

export function dump(value: any) {
  const dumper = new Dumper();
  dumper.dump(value);
  return dumper.buffer;
}

export function dumpAll(values: any[]) {
  const dumper = new Dumper();
  values.forEach(value => dumper.dump(value));
  return dumper.buffer;
}
