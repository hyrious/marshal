import { defProp } from "./internal";

export type Hash = Record<string | number | symbol, unknown>;

export class RubyBaseObject {
  declare data?: unknown;
  declare wrapped?: string | Uint8Array | RegExp | unknown[] | Hash | RubyHash;
  declare userDefined?: Uint8Array;
  declare userMarshal?: unknown;
}

export class RubyObject extends RubyBaseObject {
  declare class: symbol;
  constructor(class_: symbol) {
    super();
    defProp(this, "class", { value: class_, configurable: true });
  }
}

export class RubyStruct extends RubyBaseObject {
  declare class: symbol;
  declare members: Record<symbol, unknown>;
  constructor(class_: symbol, members?: Record<symbol, unknown>) {
    super();
    defProp(this, "class", { value: class_, configurable: true });
    if (members) defProp(this, "members", { value: members, configurable: true });
  }
}

export class RubyClass extends RubyBaseObject {
  constructor(public name: string) {
    super();
  }
}

export class RubyModule extends RubyBaseObject {
  constructor(public name: string, public old?: boolean) {
    super();
  }
}

export class RubyHash {
  declare entries: [unknown, unknown][];
  declare default?: unknown;
  constructor(entries?: [unknown, unknown][], default_?: unknown) {
    this.entries = entries || [];
    if (default_ !== undefined) this.default = default_;
  }
  /** Returns a new object that is a ruby Hash with `compare_by_identity` enabled. */
  compareByIdentity(): RubyObject {
    var obj = new RubyObject(Symbol.for("Hash"));
    obj.wrapped = this;
    return obj;
  }
}

export class RubyRange extends RubyObject {
  constructor(begin: unknown | null, end: unknown | null, exclusive: boolean) {
    super(Symbol.for("Range"));
    (this as any)[Symbol.for("begin")] = begin;
    (this as any)[Symbol.for("end")] = end;
    (this as any)[Symbol.for("excl")] = exclusive;
  }
}

export interface RubyNumeric {
  readonly isInteger: boolean;
  valueOf(): number;
}

export class RubyInteger implements RubyNumeric {
  declare isInteger: true;
  constructor(public value: number) {
    defProp(this, "isInteger", { value: true, configurable: true });
  }
  valueOf(): number {
    return this.value;
  }
}

export class RubyFloat implements RubyNumeric {
  declare isInteger: false;
  constructor(public value: number) {
    defProp(this, "isInteger", { value: false, configurable: true });
  }
  valueOf(): number {
    return this.value;
  }
}
