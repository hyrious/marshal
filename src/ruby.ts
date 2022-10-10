import { decode } from "./utils";

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
  declare instanceVariables: [symbol, any][];

  constructor() {
    this.instanceVariables = [];
  }
}

export class RubyString extends RubyBaseObject {
  constructor(public buffer: ArrayBuffer) {
    super();
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
      let str: string | undefined;
      if (typeof key === "symbol" && (str = Symbol.keyFor(key))) {
        object[str] = value;
      } else if (typeof key === "string") {
        object[key] = value;
      } else {
        throw new TypeError("RubyHash.toJS(): only support string or symbol keys");
      }
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
