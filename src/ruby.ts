import { objectFromPairs, pairsFromObject } from './utils'

/** it may be Object, Struct, Hash, Class, Module */
export class RubyBaseObject {}

export class RubyString extends RubyBaseObject {
  constructor(public buffer: ArrayBuffer) {
    super()
  }
}

export class RubyObject extends RubyBaseObject {
  /** `d`, for `_load_data`, created by ruby extensions */
  data?: ArrayBuffer
  /** `C`, wrapped String, Regexp, Array or Hash */
  wrapped?: any
  /** `u`, for `self._load`, created by user  */
  userDefined?: ArrayBuffer
  /** `U`, for `marshal_load`, created by user */
  userMarshal?: any
  /** `e`, extends module */
  extends?: symbol
  /** `I` or `o` */
  instanceVariables: [symbol, any][] = []

  constructor(
    public className: symbol,
    options?: {
      data?: ArrayBuffer
      wrapped?: any
      userDefined?: ArrayBuffer
      userMarshal?: any
      extends?: symbol
      instanceVariables?: [symbol, any][]
    }
  ) {
    super()
    Object.assign(this, options)
  }
}

/** `S` */
export class RubyStruct extends RubyBaseObject {
  constructor(public className: symbol, public pairs: [symbol, any][]) {
    super()
  }
}

/** `{`, `}` */
export class RubyHash extends RubyBaseObject {
  constructor(public pairs: [any, any][], public defaultValue?: any) {
    super()
  }

  static from(object: Record<string, any>) {
    return new RubyHash(pairsFromObject(object))
  }

  toJS() {
    return objectFromPairs(this.pairs)
  }
}

/** `c` */
export class RubyClass extends RubyBaseObject {
  constructor(public name: string) {
    super()
  }
}

/** `m` */
export class RubyModule extends RubyBaseObject {
  constructor(public name: string) {
    super()
  }
}

/** `M` */
export class RubyClassOrModule extends RubyBaseObject {
  constructor(public name: string) {
    super()
  }
}
