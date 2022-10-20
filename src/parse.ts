import * as constants from "./constants";
import * as ruby from "./ruby";
import { decode, hash_set } from "./utils";

export interface ParseOptions {
  /**
   * If `false`, don't decode buffer to string.
   * Default: true
   */
  decodeString?: boolean;

  /**
   * If `true` and `decodeString: false`, wrap the string in `RubyString`.
   * Default: false
   */
  wrapString?: boolean;

  /**
   * If `true`, return a plain js object instead of `RubyHash`.
   * Note that the keys of the hash must be symbol or string.
   * Default: false
   */
  hashToJS?: boolean;

  /**
   * If `true`, return a js map instead of `RubyHash`.
   * Note that the keys of the hash must be symbol or string.
   * Default: false
   */
  hashToMap?: boolean;
}

const default_options: Required<ParseOptions> = {
  decodeString: true,
  wrapString: false,
  hashToJS: false,
  hashToMap: false,
};

/** This class holds parser state */
export class Parser {
  declare pos_: number;
  declare view_: DataView;
  declare symbols_: symbol[];
  declare objects_: any[];
  declare options_: Required<ParseOptions>;

  constructor(view: DataView, options?: ParseOptions) {
    this.pos_ = 0;
    this.view_ = view;
    this.options_ = Object.assign({}, default_options, options);
  }

  hasNext() {
    return this.pos_ < this.view_.byteLength;
  }

  get() {
    if (this.view_.getInt16(this.pos_) !== 0x408) {
      throw new TypeError("incompatible marshal file format (can't be read)");
    }
    this.pos_ += 2;
    this.symbols_ = [];
    this.objects_ = [];
    return read_any(this);
  }
}

function read_bytes(p: Parser, n: number) {
  const begin = p.pos_;
  p.pos_ += n;
  return p.view_.buffer.slice(begin, p.pos_);
}

function read_fixnum(p: Parser) {
  const t = p.view_.getInt8(p.pos_++);
  if (t === 0) {
    return 0;
  } else if (-4 <= t && t <= 4) {
    const n = Math.abs(t);
    const shift = (4 - n) * 8;
    const bytes = new Uint8Array(read_bytes(p, n));
    let a = 0;
    for (let i = n - 1; i >= 0; --i) {
      a = (a << 8) | bytes[i];
    }
    return t > 0 ? a : (a << shift) >> shift;
  } else {
    return t > 0 ? t - 5 : t + 5;
  }
}

function read_chunk(p: Parser) {
  return read_bytes(p, read_fixnum(p));
}

function read_string(p: Parser, d: true): string;
function read_string(p: Parser, d?: boolean): ArrayBuffer | string | ruby.RubyString;
function read_string(p: Parser, d = p.options_.decodeString) {
  const chunk = read_chunk(p);
  if (d) return decode(chunk);
  else if (p.options_.wrapString) return new ruby.RubyString(chunk);
  else return chunk;
}

function read_symbol(p: Parser) {
  return Symbol.for(read_string(p, true));
}

function _push_and_return_object<T = any>(p: Parser, object: T): T {
  p.objects_.push(object);
  return object;
}

function _push_and_return_symbol(p: Parser, symbol: symbol) {
  p.symbols_.push(symbol);
  return symbol;
}

function read_entries(p: Parser) {
  const entries: [any, any][] = [];
  let n = read_fixnum(p);
  while (n--) entries.push([read_any(p), read_any(p)]);
  return entries;
}

function read_entries_p(p: Parser, f: (key: any, value: any) => void) {
  let n = read_fixnum(p);
  while (n--) f(read_any(p), read_any(p));
}

function read_bignum(p: Parser) {
  const sign = p.view_.getUint8(p.pos_++);
  const n = read_fixnum(p) * 2;
  const bytes = new Uint8Array(read_bytes(p, n));
  let a = 0;
  for (let i = 0; i < n; ++i) {
    a += bytes[i] * 2 ** (i * 8);
  }
  return sign === constants.B_POSITIVE ? a : -a;
}

function read_float(p: Parser) {
  const s = read_string(p);
  return s === "inf" ? 1 / 0 : s === "-inf" ? -1 / 0 : s === "nan" ? NaN : Number(s);
}

function read_regexp(p: Parser) {
  const source = read_string(p, true);
  const type = p.view_.getUint8(p.pos_++);
  let flag = "";
  if (type & constants.RE_IGNORECASE) flag += "i";
  if (type & constants.RE_MULTILINE) flag += "m";
  return new RegExp(source, flag);
}

function read_array(p: Parser, n: number, to: any[]) {
  for (let i = 0; i < n; ++i) {
    to[i] = read_any(p);
  }
  return to;
}

function read_any(p: Parser): any {
  const t = p.view_.getUint8(p.pos_++);

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
      return p.symbols_[read_fixnum(p)];

    case constants.T_LINK:
      return p.objects_[read_fixnum(p)];

    case constants.T_IVAR: {
      const object: any = _push_and_return_object(p, read_any(p));
      const entries = read_entries(p);
      if (object instanceof ruby.RubyBaseObject) {
        object.instanceVariables = entries;
      } else if (ruby.RubyString.isString(object)) {
        // don't error on strings because they could have an ivar of { encoding: 'utf-8' }
      } else {
        console.warn("cannot populate instance variables to non-RubyObject: " + object);
      }
      return object;
    }

    // sequence ['e', :N, 'e', :M, 'o', :A, 0] produces #<A extends=[N, M]>
    // sequence ['e', :M, 'e', :C, 'o', ';', 1(6), 0] produces #<C> whose singleton class extends [M]
    // The 'singleton class' case is determined by whether last(extends) is a RubyClass,
    // because we do not decode a ruby class to js class, we cannot know this info,
    // so we just return a RubyObject whose 'extends' is [:N, :M, :C],
    // one can still construct the real object by testing the last symbol's kind.
    case constants.T_EXTENDED: {
      const extends_: symbol[] = [read_any(p)];
      while (p.view_.getUint8(p.pos_) === constants.T_EXTENDED) {
        p.pos_++;
        extends_.push(read_any(p));
      }
      const object: any = _push_and_return_object(p, read_any(p));
      if (object instanceof ruby.RubyBaseObject) {
        object.extends = extends_;
      } else {
        console.warn("cannot populate extends to non-RubyObject: " + object);
      }
      return object;
    }

    case constants.T_ARRAY: {
      const n = read_fixnum(p);
      const array = _push_and_return_object(p, new Array(n));
      return read_array(p, n, array);
    }

    case constants.T_BIGNUM:
      return _push_and_return_object(p, read_bignum(p));

    case constants.T_CLASS:
      return _push_and_return_object(p, new ruby.RubyClass(read_string(p, true)));

    case constants.T_MODULE:
      return _push_and_return_object(p, new ruby.RubyModule(read_string(p, true)));

    case constants.T_MODULE_OLD:
      return _push_and_return_object(p, new ruby.RubyClassOrModule(read_string(p, true)));

    case constants.T_DATA: {
      const object = _push_and_return_object(p, new ruby.RubyObject(read_any(p)));
      object.data = read_any(p);
      return object;
    }

    case constants.T_FLOAT:
      return _push_and_return_object(p, read_float(p));

    case constants.T_HASH: {
      if (p.options_.hashToJS) {
        const hash: Record<string, any> = _push_and_return_object(p, {});
        read_entries_p(p, hash_set.bind(null, hash));
        return hash;
      } else if (p.options_.hashToMap) {
        const hash: Map<any, any> = _push_and_return_object(p, new Map());
        read_entries_p(p, hash.set.bind(hash));
        return hash;
      } else {
        const hash = _push_and_return_object(p, new ruby.RubyHash([]));
        hash.entries = read_entries(p);
        return hash;
      }
    }

    case constants.T_HASH_DEF: {
      if (p.options_.hashToJS) {
        const hash: Record<string, any> = _push_and_return_object(p, {});
        read_entries_p(p, hash_set.bind(null, hash));
        void read_any(p); // default value is dropped
        return hash;
      } else if (p.options_.hashToMap) {
        const hash: Map<any, any> = _push_and_return_object(p, new Map());
        read_entries_p(p, hash.set.bind(hash));
        void read_any(p); // default value is dropped
        return hash;
      } else {
        const hash = _push_and_return_object(p, new ruby.RubyHash([]));
        hash.entries = read_entries(p);
        hash.defaultValue = read_any(p);
        return hash;
      }
    }

    case constants.T_OBJECT: {
      const object = _push_and_return_object(p, new ruby.RubyObject(read_any(p)));
      object.instanceVariables = read_entries(p);
      return object;
    }

    case constants.T_REGEXP:
      return _push_and_return_object(p, read_regexp(p));

    case constants.T_STRING:
      return _push_and_return_object(p, read_string(p));

    case constants.T_STRUCT: {
      const struct = _push_and_return_object(p, new ruby.RubyStruct(read_any(p), []));
      struct.members = read_entries(p);
      return struct;
    }

    case constants.T_UCLASS: {
      const object = _push_and_return_object(p, new ruby.RubyObject(read_any(p)));
      object.wrapped = read_any(p);
      return object;
    }

    case constants.T_USERDEF: {
      const object = _push_and_return_object(p, new ruby.RubyObject(read_any(p)));
      object.userDefined = read_chunk(p);
      return object;
    }

    case constants.T_USERMARSHAL: {
      const object = _push_and_return_object(p, new ruby.RubyObject(read_any(p)));
      object.userMarshal = read_any(p);
      return object;
    }
  }
}

/**
 * Load one marshal section from buffer.
 *
 * If you need to load multiple times (like RGSS1), use `loadAll`.
 * ```js
 * load(fs.readFileSync('Scripts.rvdata2').buffer)
 * file.arrayBuffer().then(buffer => load(buffer))
 * ```
 */
export function load(buffer: ArrayBuffer, options?: ParseOptions) {
  const view = new DataView(buffer);
  return new Parser(view, options).get();
}

/**
 * Load all marshal sections from buffer.
 */
export function loadAll(buffer: ArrayBuffer, options?: ParseOptions) {
  const view = new DataView(buffer);
  const parser = new Parser(view, options);
  const result = [];
  while (parser.hasNext()) {
    result.push(parser.get());
  }
  return result;
}
