import isPlainObject from "is-plain-obj";
import { decode, hash_set } from "./utils";

export class RubyBaseObject {
  /** `d`, for `_load_data`, created by ruby extensions */
  declare data?: ArrayBuffer;
  /** `C`, wrapped String, Regexp, Array or Hash */
  declare wrapped?: any;
  /** `u`, for `self._load`, created by user  */
  declare userDefined?: ArrayBuffer;
  /** `U`, for `marshal_load`, created by user */
  declare userMarshal?: any;
  /** `e`, extends module */
  declare extends?: symbol[];
  /** `I` or `o` */
  declare instanceVariables?: [symbol, any][];
}

export class RubyString extends RubyBaseObject {
  constructor(public buffer: ArrayBuffer) {
    super();
  }
  static isString(a: any): a is ArrayBuffer | string | RubyString {
    return typeof a === "string" || a instanceof ArrayBuffer || a instanceof RubyString;
  }
  toString() {
    return decode(this.buffer);
  }
}

export class RubyObject extends RubyBaseObject {
  constructor(
    public className: symbol,
    options?: {
      data?: ArrayBuffer;
      wrapped?: any;
      userDefined?: ArrayBuffer;
      userMarshal?: any;
      extends?: symbol[];
      instanceVariables?: [symbol, any][];
    }
  ) {
    super();
    Object.assign(this, options);
  }
}

/** `S` */
export class RubyStruct extends RubyBaseObject {
  constructor(public className: symbol, public members: [symbol, any][]) {
    super();
  }
}

/** `{`, `}` */
export class RubyHash extends RubyBaseObject {
  constructor(public entries: [any, any][], public defaultValue?: any) {
    super();
  }
  static isHash(a: any): a is Record<string, any> | Map<any, any> | RubyHash {
    return a instanceof Map || a instanceof RubyHash || isPlainObject(a);
  }
  static from(object: Record<string, any> | Map<any, any> | RubyHash) {
    if (object instanceof RubyHash) {
      return new RubyHash(object.entries, object.defaultValue);
    }
    let entries: [symbol, any][];
    if (object instanceof Map) {
      entries = Array.from(object.entries());
    } else {
      entries = [];
      for (const key of Object.keys(object)) {
        entries.push([Symbol.for(key), object[key]]);
      }
    }
    return new RubyHash(entries);
  }
  toJS() {
    const object: Record<string, any> = {};
    for (const [key, value] of this.entries) {
      hash_set(object, key, value);
    }
    return object;
  }
  toMap() {
    return new Map(this.entries);
  }
}

/** `c` */
export class RubyClass extends RubyBaseObject {
  constructor(public name: string) {
    super();
  }
}

/** `m` */
export class RubyModule extends RubyBaseObject {
  constructor(public name: string) {
    super();
  }
}

/** `M` */
export class RubyClassOrModule extends RubyBaseObject {
  constructor(public name: string) {
    super();
  }
}

/** 1..2 */
export class RubyRange extends RubyStruct {
  constructor(begin: number | null, end: number | null, exclusive: boolean) {
    super(Symbol.for("Range"), [
      [Symbol.for("excl"), exclusive],
      [Symbol.for("begin"), begin],
      [Symbol.for("end"), end],
    ]);
  }
}

export class RubyTime extends RubyObject {
  constructor(date: Date | number, zone = "UTC", offset = 0) {
    if (typeof date === "number") date = new Date(date);
    const year = date.getUTCFullYear();
    const mon = date.getUTCMonth();
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const min = date.getUTCMinutes();
    const sec = date.getUTCSeconds();
    const u_sec = date.getUTCMilliseconds();
    const p = 0xc0000000 + (((year - 1900) << 14) | ((mon - 1) << 14) | (day << 5) | hour);
    const s = (min << 26) | (sec << 20) | u_sec;

    super(Symbol.for("Time"), {
      userDefined: Uint32Array.of(p, s).buffer,
      instanceVariables: [[Symbol.for("zone"), zone]],
    });

    if (offset) {
      this.instanceVariables!.unshift([Symbol.for("offset"), offset]);
    }
  }
}
