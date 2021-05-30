/** it may be Object, Struct, Hash, Class, Module */
export class RubyBaseObject {}

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
  extends?: Symbol
  /** `I` or `o`, special ivar `:E` is omitted */
  instanceVariables: [Symbol, any][] = []

  constructor(
    public className: Symbol,
    options?: {
      data?: ArrayBuffer
      wrapped?: any
      userDefined?: ArrayBuffer
      userMarshal?: any
      extends?: Symbol
      instanceVariables?: [Symbol, any][]
    }
  ) {
    super()
    Object.assign(this, options)
  }
}

/** `S` */
export class RubyStruct extends RubyBaseObject {
  constructor(public className: Symbol, public pairs: [Symbol, any][]) {
    super()
  }
}

/** `{`, `}` */
export class RubyHash extends RubyBaseObject {
  constructor(public pairs: [any, any][], public defaultValue?: any) {
    super()
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
