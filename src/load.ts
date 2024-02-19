import * as constants from "./constants";
import { decode, defProp, define_extends, define_hash_default } from "./internal";
import {
  type Hash,
  RubyClass,
  RubyFloat,
  RubyHash,
  RubyInteger,
  RubyModule,
  RubyObject,
  RubyStruct,
} from "./ruby";

export interface ClassLike {
  readonly name: string;
  readonly prototype: object | null;
}

export interface LoadOptions {
  /**
   * If set, force the encoding of strings, otherwise strings will be decoded on demand.
   * ```js
   * load(data) // => ["foo", Uint8Array(3) [102, 111, 111]]
   * load(data, { string: "utf8" }) // => ["foo", "foo"]
   * load(data, { string: "binary" }) // => [Uint8Array(3) [102, 111, 111], Uint8Array(3) [102, 111, 111]]
   * ```
   */
  string?: "binary" | "utf8";

  /**
   * If set, put integers and floats in RubyInteger and RubyFloat.
   * No bigint support now.
   * ```js
   * load(data) // => 1
   * load(data, { numeric: "wrap" }) // => RubyFloat { value: 1 }
   * load(data, { numeric: "wrap" }) // => RubyInteger { value: 1 }
   * ```
   */
  numeric?: "wrap";

  /**
   * If true, convert symbol keys to string when decoding ruby Hash in JS objects.
   * ```js
   * load(data) // => { Symbol(a): 1 }
   * load(data, { hashSymbolKeysToString: true }) // => { a: 1 }
   * ```
   */
  hashSymbolKeysToString?: boolean;

  /**
   * Instead of JS object, decode ruby Hash as Map or RubyHash.
   * `hashSymbolKeysToString` is ignored when this option is set.
   * ```js
   * load(data) // => { a: 1 }
   * load(data, { hash: "map" }) // => Map { "a" => 1 }
   * load(data, { hash: "wrap" }) // => RubyHash { entries: [["a", 1]] }
   * ```
   */
  hash?: "map" | "wrap";

  /**
   * If set, put instance variables (often :@key) as string keys in JS objects.
   * If set a string, replace the '@' with the string.
   * Be careful that these ivars won't get dump()ed back.
   * ```js
   * load(data) // => RubyObject { Symbol(@a): 1 }
   * load(data, { ivarToString: true }) // => RubyObject { "@a": 1 }
   * load(data, { ivarToString: "" }) // => RubyObject { "a": 1 }
   * load(data, { ivarToString: "_" }) // => RubyObject { "_a": 1 }
   * ```
   */
  ivarToString?: boolean | string;

  /**
   * If set, use this known classes to decode ruby objects.
   * ```js
   * class A {}
   * load(data) // => RubyObject { class: Symbol(A) }
   * load(data, { known: { A } }) // => A {}
   * ```
   */
  known?: { [klass: string]: ClassLike };
}

class Loader {
  declare pos_: number;
  declare view_: DataView;
  declare symbols_: symbol[];
  declare objects_: unknown[];
  declare options_: LoadOptions;

  constructor(view: DataView, options: LoadOptions = {}) {
    this.pos_ = 0;
    this.view_ = view;
    this.symbols_ = [];
    this.objects_ = [];
    this.options_ = options;
  }

  hasNext_() {
    return this.pos_ < this.view_.byteLength;
  }

  get_() {
    if (this.pos_ + 2 >= this.view_.byteLength) {
      throw new TypeError("marshal data too short");
    }
    if (this.view_.getInt16(this.pos_) !== 0x408) {
      throw new TypeError("incompatible marshal file format (can't be read)");
    }
    this.pos_ += 2;
    var value = read_any(this);
    this.symbols_.length = 0;
    this.objects_.length = 0;
    return value;
  }
}

const read_byte = (p: Loader): number => {
  if (p.pos_ >= p.view_.byteLength) {
    throw new TypeError("marshal data too short");
  }
  return p.view_.getUint8(p.pos_++);
};

const read_bytes = (p: Loader, n: number) => {
  if (p.pos_ + n > p.view_.byteLength) {
    throw new TypeError("marshal data too short");
  }
  return new Uint8Array(p.view_.buffer, p.view_.byteOffset + (p.pos_ += n) - n, n);
};

const read_fixnum = (p: Loader): number => {
  if (p.pos_ >= p.view_.byteLength) {
    throw new TypeError("marshal data too short");
  }
  var t = p.view_.getInt8(p.pos_++);
  if (t === 0) {
    return 0;
  } else if (-4 <= t && t <= 4) {
    for (var n = Math.abs(t), s = (4 - n) * 8, b = read_bytes(p, n), a = 0, i = n - 1; i >= 0; --i)
      a = (a << 8) | b[i];
    return t > 0 ? a : (a << s) >> s;
  } else {
    return t > 0 ? t - 5 : t + 5;
  }
};

const read_chunk = (p: Loader): Uint8Array => read_bytes(p, read_fixnum(p));

// note: do not use read_string() to really load the string, decode it on demand
const read_string = (p: Loader): string => decode(read_chunk(p));

const push_object = <T = unknown,>(p: Loader, obj: T): T => {
  p.objects_.push(obj);
  return obj;
};

const push_symbol = (p: Loader, sym: symbol) => {
  p.symbols_.push(sym);
  return sym;
};

const read_bignum = (p: Loader): number => {
  for (var sign = read_byte(p), n = read_fixnum(p) << 1, b = read_bytes(p, n), a = 0, i = 0; i < n; ++i)
    a += b[i] * 2 ** (i << 3);
  return sign === constants.B_POSITIVE ? a : -a;
};

const read_float = (p: Loader): number => {
  var s = read_string(p);
  return s === "inf" ? 1 / 0 : s === "-inf" ? -1 / 0 : s === "nan" ? NaN : Number(s);
};

const read_regexp = (p: Loader): RegExp => {
  var s = read_string(p);
  var t = read_byte(p);
  var f = "";
  if (t & constants.RE_IGNORECASE) f += "i";
  if (t & constants.RE_MULTILINE) f += "m";
  return new RegExp(s, f);
};

const hash_set = (h: Hash, k: unknown, v: unknown, sym2str?: boolean): Hash => {
  var t = typeof k;
  if (t === "symbol" || t === "string" || t === "number") {
    if (sym2str && t === "symbol") k = Symbol.keyFor(k as symbol);
    h[k as string | number | symbol] = v;
  } else if (k instanceof Uint8Array) {
    h[decode(k)] = v;
  } else if (k instanceof RubyInteger || k instanceof RubyFloat) {
    h[k.value] = v;
  }
  return h;
};

const ivar_set = (o: {}, k: unknown, v: unknown, ivar2str?: boolean | string) => {
  if (ivar2str === void 0 || ivar2str === false) o[k as any] = v;
  else {
    var s = Symbol.keyFor(k as symbol)!;
    if (ivar2str === true) o[s] = v;
    else o[s.replace(/^@/, ivar2str)] = v;
  }
};

const read_any = (p: Loader): unknown => {
  var t = read_byte(p);
  var string = p.options_.string;
  var numeric = p.options_.numeric === "wrap";
  var ivar2str = p.options_.ivarToString;
  var known = p.options_.known || {};

  switch (t) {
    case constants.T_NIL:
      return null;
    case constants.T_TRUE:
      return true;
    case constants.T_FALSE:
      return false;
    case constants.T_FIXNUM:
      var i = read_fixnum(p);
      return numeric ? new RubyInteger(i) : i;

    case constants.T_SYMBOL:
      return push_symbol(p, Symbol.for(read_string(p)));
    case constants.T_SYMLINK:
      return p.symbols_[read_fixnum(p)];
    case constants.T_LINK:
      return p.objects_[read_fixnum(p)];

    case constants.T_IVAR:
      for (var o = read_any(p), n = read_fixnum(p), i = 0, k, v; i < n; ++i) {
        k = read_any(p);
        v = read_any(p);
        // if a string (read as uint8array) has ivar :E or :encoding, decode it
        if (
          o instanceof Uint8Array &&
          (k === constants._E || k === constants._encoding) &&
          string !== "binary"
        ) {
          if (k === constants._E) o = decode(o);
          else o = new TextDecoder(decode(v as Uint8Array)).decode(o);
          p.objects_[p.objects_.length - 1] = o;
        }
        // otherwise try to put the ivar
        else if (o != null) {
          // primitives (boolean, number, string, symbol, ...) cannot hold properties,
          // so code below silently fail. other objects get a [Symbol(@key)] property
          ivar_set(o, k, v, ivar2str);
        }
      }
      return o;

    // sequence ['e', :N, 'e', :M, 'o', :A, 0] produces #<A extends=[N, M]>
    // sequence ['e', :M, 'e', :C, 'o', :C, 0] produces #<C> whose singleton class prepends [M]
    // the 'singleton class' case is determined by whether the last 'e' is a class
    // here we just prepend the extends into obj.__ruby_extends__
    case constants.T_EXTENDED:
      var sym = read_any(p) as symbol;
      var o = read_any(p);
      var e = define_extends(o);
      if (e) e.unshift(sym);
      return o;

    case constants.T_ARRAY:
      for (var n = read_fixnum(p), a = push_object(p, Array(n)) as unknown[], i = 0; i < n; ++i)
        a[i] = read_any(p);
      return a;

    case constants.T_BIGNUM:
      var i = read_bignum(p);
      return push_object(p, numeric ? new RubyInteger(i) : i);

    case constants.T_CLASS:
      return push_object(p, new RubyClass(read_string(p)));
    case constants.T_MODULE:
    case constants.T_MODULE_OLD:
      return push_object(p, new RubyModule(read_string(p), t === constants.T_MODULE_OLD));

    case constants.T_FLOAT:
      var i = read_float(p);
      return push_object(p, numeric ? new RubyFloat(i) : i);

    case constants.T_HASH:
    case constants.T_HASH_DEF:
      var type = p.options_.hash;
      var sym2str = p.options_.hashSymbolKeysToString;
      if (type === "map") {
        for (var n = read_fixnum(p), m: Map<unknown, unknown> = push_object(p, new Map()), i = 0; i < n; ++i)
          m.set(read_any(p), read_any(p));
        if (t === constants.T_HASH_DEF) define_hash_default(m, read_any(p));
        return m;
      } else if (type === "wrap") {
        for (var n = read_fixnum(p), w = push_object(p, new RubyHash([])), i = 0; i < n; ++i)
          w.entries.push([read_any(p), read_any(p)]);
        if (t === constants.T_HASH_DEF) w.default = read_any(p);
        return w;
      } else {
        for (var n = read_fixnum(p), h: Hash = push_object(p, {}), i = 0; i < n; ++i)
          hash_set(h, read_any(p), read_any(p), sym2str);
        if (t === constants.T_HASH_DEF) define_hash_default(h, read_any(p));
        return h;
      }

    case constants.T_OBJECT:
      var klass = read_any(p) as symbol;
      var cls = known[Symbol.keyFor(klass)!];
      var obj: RubyObject = push_object(p, cls ? Object.create(cls.prototype) : new RubyObject(klass));
      for (var n = read_fixnum(p), i = 0, k, v; i < n; ++i) {
        k = read_any(p);
        v = read_any(p);
        ivar_set(obj, k, v, ivar2str);
      }
      return obj;

    case constants.T_REGEXP:
      return push_object(p, read_regexp(p));

    case constants.T_STRING:
      return push_object(p, string === "utf8" ? read_string(p) : read_chunk(p));

    case constants.T_STRUCT:
      var s = push_object(p, new RubyStruct(read_any(p) as symbol));
      for (var n = read_fixnum(p), h: Hash = {}, i = 0; i < n; ++i) hash_set(h, read_any(p), read_any(p));
      defProp(s, "members", { value: h, configurable: true });
      return s;

    case constants.T_DATA:
    case constants.T_UCLASS:
    case constants.T_USERDEF:
    case constants.T_USERMARSHAL:
      var obj = push_object(p, new RubyObject(read_any(p) as symbol));
      if (t === constants.T_DATA) obj.data = read_any(p);
      if (t === constants.T_UCLASS) obj.wrapped = read_any(p) as typeof obj.wrapped;
      if (t === constants.T_USERDEF) obj.userDefined = read_chunk(p);
      if (t === constants.T_USERMARSHAL) obj.userMarshal = read_any(p);
      return obj;
  }
};

const toBinary = (s: string): Uint8Array => {
  for (var a = new Uint8Array(s.length), i = 0; i < s.length; ++i) {
    a[i] = s.charCodeAt(i);
  }
  return a;
};

const toDataView = (data: string | Uint8Array | ArrayBuffer): DataView => {
  if (typeof data === "string") data = toBinary(data);
  if (data instanceof ArrayBuffer) return new DataView(data);
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
};

/**
 * Load one marshal section from buffer.
 *
 * If you need to load multiple times (like RGSS1), use `loadAll`.
 * ```js
 * load(fs.readFileSync('Scripts.rvdata2'))
 * load(await file.arrayBuffer())
 * ```
 */
export function load(data: string | Uint8Array | ArrayBuffer, options?: LoadOptions): unknown {
  return new Loader(toDataView(data), options).get_();
}

export function loadAll(data: string | Uint8Array | ArrayBuffer, options?: LoadOptions): unknown[] {
  var p = new Loader(toDataView(data), options);
  for (var a: unknown[] = []; p.hasNext_(); ) {
    a.push(p.get_());
  }
  return a;
}
