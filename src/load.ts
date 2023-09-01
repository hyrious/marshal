import * as constants from "./constants";
import * as ruby from "./ruby";
import {
  decodeUTF8,
  decode_bignum,
  extmod,
  hash_default,
  hash_set,
  ivars,
  option_to_str,
  str_to_float,
  symbol_to_str,
} from "./utils";

export interface LoadOptions {
  /**
   * If `true`, use the Ruby{Fixnum|Bignum|Float} wrapper instead of the primitive number.
   * These wrappers make it possible to distinguish between integer 1 and float 1.
   * Default: `false`
   */
  wrapNumber?: boolean;

  /**
   * If `true`, instead of generating the RubyString wrapper, use the primitive string.
   * Be careful that only `UTF8` is supported.
   * Default: `false`
   */
  decodeString?: boolean;

  /**
   * If `true`, instead of generating the RubySymbol wrapper, use the primitive symbol.
   * Be careful that only `UTF8` is supported.
   * Default: `false`
   */
  decodeSymbol?: boolean;

  /**
   * If `true`, instead of generating the RubyRegexp wrapper, use the primitive RegExp.
   * Be careful that only `UTF8` is supported, and only the `i` and `m` flags are kept.
   * Default: `false`
   */
  decodeRegexp?: boolean;

  /**
   * If `true`, use RubyArray wrapper instead of js array.
   * Default: `false`
   */
  wrapArray?: boolean;

  /**
   * If `true`, use the RubyHash wrapper instead of js plain object.
   * If `map`, use js map.
   * Otherwise (`false` or `js`), use js plain object.
   * Default: `false`
   */
  wrapHash?: boolean | "map" | "js";

  /**
   * If set, instead of generating the RubyObject wrapper, use the given class.
   */
  knownClasses?: Record<string, { readonly prototype: any }>;
}

/** This class holds loader state */
class Loader {
  declare pos_: number;
  declare view_: DataView;
  declare symbols_: (symbol | ruby.RubySymbol)[];
  declare objects_: any[];
  declare options_: LoadOptions;

  constructor(view: DataView, options: LoadOptions = {}) {
    this.pos_ = 0;
    this.view_ = view;
    this.symbols_ = [];
    this.objects_ = [];
    this.options_ = options;
  }

  hasNext_(): boolean {
    return this.pos_ + 2 < this.view_.byteLength && this.view_.getInt16(this.pos_) === 0x408;
  }

  get_(): any {
    if (this.view_.getInt16(this.pos_) !== 0x408) {
      throw new TypeError("incompatible marshal file format (can't be read)");
    }
    this.pos_ += 2;
    try {
      return read_any(this);
    } finally {
      this.symbols_ = [];
      this.objects_ = [];
    }
  }

  getInt8_(): number {
    return this.view_.getInt8(this.pos_++);
  }

  getUint8_(): number {
    return this.view_.getUint8(this.pos_++);
  }

  peakUint8_(): number {
    return this.view_.getUint8(this.pos_);
  }
}

function read_bytes(p: Loader, n: number): Uint8Array {
  const ret = new Uint8Array(p.view_.buffer, p.view_.byteOffset + p.pos_, n);
  p.pos_ += n;
  return ret;
}

function read_fixnum(p: Loader, w: true): ruby.RubyFixnum;
function read_fixnum(p: Loader, w: false): number;
function read_fixnum(p: Loader, w?: boolean): number | ruby.RubyFixnum;
function read_fixnum(p: Loader, wrap = p.options_.wrapNumber) {
  var value: number;
  const t = p.getInt8_();
  if (t === 0) {
    value = 0;
  } else if (-4 <= t && t <= 4) {
    const n = Math.abs(t);
    const shift = (4 - n) * 8;
    const bytes = read_bytes(p, n);
    let a = 0;
    for (let i = n - 1; i >= 0; --i) {
      a = (a << 8) | bytes[i];
    }
    value = t > 0 ? a : (a << shift) >> shift;
  } else {
    value = t > 0 ? t - 5 : t + 5;
  }
  return wrap ? ruby.makeFixnum(value) : value;
}

function read_chunk(p: Loader) {
  return read_bytes(p, read_fixnum(p, false));
}

function read_string(p: Loader, d: true): string;
function read_string(p: Loader, d: false): ruby.RubyString;
function read_string(p: Loader, d?: boolean): string | ruby.RubyString;
function read_string(p: Loader, decode = p.options_.decodeString) {
  const contents = read_chunk(p);
  if (decode) return decodeUTF8(contents);
  return ruby.makeString(contents);
}

function read_symbol(p: Loader, d: true): symbol;
function read_symbol(p: Loader, d: false): ruby.RubySymbol;
function read_symbol(p: Loader, d?: boolean): symbol | ruby.RubySymbol;
function read_symbol(p: Loader, decode = p.options_.decodeSymbol) {
  const contents = read_chunk(p);
  if (decode) return Symbol.for(decodeUTF8(contents));
  return ruby.makeSymbol(contents);
}

function read_class(p: Loader): ruby.RubyClass {
  return ruby.makeClass(read_chunk(p));
}

function read_module(p: Loader): ruby.RubyModule {
  return ruby.makeModule(read_chunk(p));
}

function read_class_or_module(p: Loader): ruby.RubyClassOrModule {
  return ruby.makeClassOrModule(read_chunk(p));
}

function _push_and_return_object<T = any>(p: Loader, object: T): T {
  p.objects_.push(object);
  return object;
}

function _push_and_return_symbol(p: Loader, symbol: symbol | ruby.RubySymbol): symbol | ruby.RubySymbol {
  p.symbols_.push(symbol);
  return symbol;
}

function read_entries(p: Loader): [any, any][] {
  const entries: [any, any][] = [];
  let n = read_fixnum(p, false);
  while (n--) entries.push([read_any(p), read_any(p)]);
  return entries;
}

function read_entries_p(p: Loader, f: (key: any, value: any) => void): void {
  let n = read_fixnum(p, false);
  while (n--) f(read_any(p), read_any(p));
}

function read_hash(p: Loader, def: boolean, wrap = p.options_.wrapHash): ruby.HashLike {
  let hash: any;
  if (!wrap || wrap === "js") {
    hash = _push_and_return_object(p, {});
    read_entries_p(p, hash_set.bind(null, hash));
    if (def) hash_default(hash, read_any(p));
  } else if (wrap === "map") {
    hash = _push_and_return_object(p, new Map());
    read_entries_p(p, hash.set.bind(hash));
    if (def) hash_default(hash, read_any(p));
  } else {
    hash = _push_and_return_object(p, ruby.makeHash());
    hash.entries = read_entries(p);
    if (def) hash.default = read_any(p);
  }
  return hash;
}

function read_bignum(p: Loader, w: true): ruby.RubyBignum;
function read_bignum(p: Loader, w: false): number;
function read_bignum(p: Loader, w?: boolean): number | ruby.RubyBignum;
function read_bignum(p: Loader, wrap = p.options_.wrapNumber) {
  const sign = p.getUint8_() === constants.B_POSITIVE ? 1 : -1;
  const n = read_fixnum(p, false) * 2;
  const bytes = read_bytes(p, n);
  if (!wrap) return decode_bignum(sign, bytes);
  return ruby.makeBignum(sign, bytes);
}

function read_float(p: Loader, w: true): ruby.RubyFloat;
function read_float(p: Loader, w: false): number;
function read_float(p: Loader, w?: boolean): number | ruby.RubyFloat;
function read_float(p: Loader, wrap = p.options_.wrapNumber) {
  const text = read_string(p, true);
  if (!wrap) return str_to_float(text);
  return ruby.makeFloat(text);
}

function read_regexp(p: Loader, d: true): RegExp;
function read_regexp(p: Loader, d: false): ruby.RubyRegexp;
function read_regexp(p: Loader, d?: boolean): RegExp | ruby.RubyRegexp;
function read_regexp(p: Loader, decode = p.options_.decodeRegexp) {
  const contents = read_chunk(p);
  const options = p.getUint8_();
  if (decode) return new RegExp(decodeUTF8(contents), option_to_str(options));
  return ruby.makeRegexp(contents, options);
}

function read_array(p: Loader, w: true): ruby.RubyArray;
function read_array(p: Loader, w: false): any[];
function read_array(p: Loader, w?: boolean): any[] | ruby.RubyArray;
function read_array(p: Loader, wrap = p.options_.wrapArray) {
  const n = read_fixnum(p, false);
  const array = new Array(n);
  const obj = wrap ? ruby.makeArray(array) : array;
  _push_and_return_object(p, obj);
  for (let i = 0; i < n; ++i) array[i] = read_any(p);
  return obj;
}

function read_data(p: Loader): ruby.RubyData {
  const obj = _push_and_return_object(p, ruby.makeData(read_any(p)));
  obj.data = read_any(p);
  return obj as ruby.RubyData;
}

function read_struct(p: Loader): ruby.RubyStruct {
  const obj = _push_and_return_object(p, ruby.makeStruct(read_any(p)));
  obj.members = read_entries(p);
  return obj as ruby.RubyStruct;
}

function read_wrapped(p: Loader): ruby.RubyWrapped {
  const obj = _push_and_return_object(p, ruby.makeWrapped(read_any(p)));
  obj.wrapped = read_any(p);
  return obj as ruby.RubyWrapped;
}

function read_user_defined(p: Loader): ruby.RubyUserDefined {
  const obj = _push_and_return_object(p, ruby.makeUserDefined(read_any(p)));
  obj.contents = read_chunk(p);
  return obj as ruby.RubyUserDefined;
}

function read_user_marshal(p: Loader): ruby.RubyUserMarshal {
  const obj = _push_and_return_object(p, ruby.makeUserMarshal(read_any(p)));
  obj.value = read_any(p);
  return obj as ruby.RubyUserMarshal;
}

function read_object(p: Loader): any | ruby.RubyObject {
  const className = read_any(p);
  const known = p.options_.knownClasses || {};
  const class_ = known[symbol_to_str(className)];
  const obj = class_ ? Object.create(class_.prototype) : ruby.makeObject(className);
  return ivars(_push_and_return_object(p, obj), read_entries(p)) as ruby.RubyObject;
}

function read_any(p: Loader): any {
  const t = p.getUint8_();

  switch (t) {
    case constants.T_TRUE:
      return true;

    case constants.T_FALSE:
      return false;

    case constants.T_NIL:
      return null;

    case constants.T_FIXNUM:
      return read_fixnum(p);

    case constants.T_SYMBOL:
      return _push_and_return_symbol(p, read_symbol(p));

    case constants.T_SYMLINK:
      return p.symbols_[read_fixnum(p, false)];

    case constants.T_LINK:
      return p.objects_[read_fixnum(p, false)];

    case constants.T_IVAR:
      return ivars(_push_and_return_object(p, read_any(p)), read_entries(p));

    // sequence ['e', :N, 'e', :M, 'o', :A, 0] produces #<A extends=[N, M]>
    // sequence ['e', :M, 'e', :C, 'o', ';', 1(6), 0] produces #<C> whose singleton class prepends [M]
    // The 'singleton class' case is determined by whether last(extends) is a RubyClass,
    // because we do not decode a ruby class to js class, we cannot know this info,
    // so we just return a RubyObject whose 'extends' is [:N, :M, :C],
    // one can still construct the real object by testing the last symbol's kind.
    case constants.T_EXTENDED: {
      const mods: (symbol | ruby.RubySymbol)[] = [read_any(p)];
      while (p.peakUint8_() === constants.T_EXTENDED) {
        p.pos_++;
        mods.push(read_any(p));
      }
      return extmod(_push_and_return_object(p, read_any(p)), mods);
    }

    case constants.T_ARRAY:
      return read_array(p);

    case constants.T_BIGNUM:
      return _push_and_return_object(p, read_bignum(p));

    case constants.T_CLASS:
      return _push_and_return_object(p, read_class(p));

    case constants.T_MODULE:
      return _push_and_return_object(p, read_module(p));

    case constants.T_MODULE_OLD:
      return _push_and_return_object(p, read_class_or_module(p));

    case constants.T_DATA:
      return read_data(p);

    case constants.T_FLOAT:
      return _push_and_return_object(p, read_float(p));

    case constants.T_HASH:
    case constants.T_HASH_DEF:
      return read_hash(p, t === constants.T_HASH_DEF);

    case constants.T_OBJECT:
      return read_object(p);

    case constants.T_REGEXP:
      return _push_and_return_object(p, read_regexp(p));

    case constants.T_STRING:
      return _push_and_return_object(p, read_string(p));

    case constants.T_STRUCT:
      return read_struct(p);

    case constants.T_UCLASS:
      return read_wrapped(p);

    case constants.T_USERDEF:
      return read_user_defined(p);

    case constants.T_USERMARSHAL:
      return read_user_marshal(p);
  }
}

function toDataView(value: Uint8Array | ArrayBuffer): DataView {
  if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
    return new DataView(value as ArrayBuffer);
  } else {
    return new DataView(
      (value as Uint8Array).buffer,
      (value as Uint8Array).byteOffset,
      (value as Uint8Array).byteLength
    );
  }
}

/**
 * Load one marshal section from buffer.
 *
 * If you need to load multiple times (like RGSS1), use `loadAll`.
 * ```js
 * load(fs.readFileSync('Scripts.rvdata2'))
 * load(await file.arrayBuffer())
 * ```
 */
export function load(data: Uint8Array | ArrayBuffer, options?: LoadOptions): any {
  return new Loader(toDataView(data), options).get_();
}

/**
 * Load all marshal sections from buffer.
 */
export function loadAll(data: Uint8Array | ArrayBuffer, options?: LoadOptions): any[] {
  const parser = new Loader(toDataView(data), options);
  const result = [];
  while (parser.hasNext_()) {
    result.push(parser.get_());
  }
  return result;
}
