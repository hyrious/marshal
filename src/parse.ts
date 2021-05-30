import {
  RubyClass,
  RubyClassOrModule,
  RubyHash,
  RubyModule,
  RubyObject,
  RubyStruct,
} from './ruby'
import { BignumSign, RegexpOption, Type } from './types'
import { stringFromBuffer, withIVar, withMod } from './utils'

/** It occurs when the marshal data is not valid. */
export class FormatError extends SyntaxError {
  constructor(message?: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/**
 * Call `get()` to read once, one file can store multiple marshal data.
 * @example
 * new Parser(dataView).get()
 */
export class Parser {
  pos = 0
  #symbols: Symbol[] = []
  /** except true, false, nil, Fixnums and Symbols */
  #objects: any[] = []

  constructor(public view: DataView) {}

  public hasNext() {
    return this.pos < this.view.byteLength
  }

  private getBytes(length: number) {
    const { view, pos } = this
    this.pos += length
    return view.buffer.slice(pos, pos + length)
  }

  private getFixnum() {
    const t = this.view.getInt8(this.pos++)
    if (t === 0x00) {
      return 0
    } else if (-4 <= t && t <= 4) {
      const n = Math.abs(t)
      const shift = (4 - n) * 8
      const bytes = new Uint8Array(this.getBytes(n))
      let a = 0
      for (let index = n - 1; index >= 0; --index) {
        a = (a << 8) | bytes[index]
      }
      return t > 0 ? a : (a << shift) >> shift
    } else {
      return t > 0 ? t - 5 : t + 5
    }
  }

  private getChunk() {
    return this.getBytes(this.getFixnum())
  }

  private getString() {
    return stringFromBuffer(this.getChunk())
  }

  private getSymbol() {
    return Symbol.for(this.getString())
  }

  private pushAndReturnSymbol(symbol: Symbol) {
    this.#symbols.push(symbol)
    return symbol
  }

  private pushAndReturnObject(object: any) {
    this.#objects.push(object)
    return object
  }

  private getItems() {
    const count = this.getFixnum()
    const array = []
    for (let index = 0; index < count; ++index) {
      array.push(this.getAny())
    }
    return array
  }

  private getPairs() {
    const count = this.getFixnum()
    const pairs: [any, any][] = []
    for (let index = 0; index < count; ++index) {
      const key = this.getAny()
      const value = this.getAny()
      pairs.push([key, value])
    }
    return pairs
  }

  private getBignum() {
    const sign = this.view.getUint8(this.pos++) as BignumSign
    const count = this.getFixnum() * 2
    const bytes = new Uint8Array(this.getBytes(count))
    let a = 0
    for (let index = 0; index < count; ++index) {
      a += bytes[index] * 2 ** (index * 8)
    }
    return sign === BignumSign.POSITIVE ? a : -a
  }

  private getFloat() {
    const string = this.getString()
    switch (string) {
      case 'inf':
        return Number.POSITIVE_INFINITY
      case '-inf':
        return Number.NEGATIVE_INFINITY
      case 'nan':
        return Number.NaN
      default:
        return Number(string)
    }
  }

  private getRegExp() {
    const source = this.getString()
    const type = this.view.getUint8(this.pos++)
    let flags = ''
    if (type & RegexpOption.IGNORECASE) flags += 'i'
    if (type & RegexpOption.MULTILINE) flags += 'm'
    return new RegExp(source, flags)
  }

  public get() {
    if (this.view.getInt16(this.pos) !== 0x4_08) {
      throw new FormatError('unsupported marshal version, expecting 4.8')
    }
    this.pos += 2
    return this.getAny()
  }

  private getAny(): any {
    const t = this.view.getUint8(this.pos++)
    const chr = String.fromCharCode(t) as Type
    switch (chr) {
      case Type.TRUE:
        return true

      case Type.FALSE:
        return false

      case Type.NIL:
        return null

      case Type.FIXNUM:
        return this.getFixnum()

      case Type.SYMBOL:
        return this.pushAndReturnSymbol(this.getSymbol())

      case Type.SYMBOL_REF:
        return this.#symbols[this.getFixnum()]

      case Type.OBJECT_REF:
        return this.#objects[this.getFixnum() - 1]

      case Type.IVAR:
        return this.pushAndReturnObject(
          withIVar(this.getAny(), this.getPairs())
        )

      case Type.EXTEND:
        return this.pushAndReturnObject(withMod(this.getAny(), this.getAny()))

      case Type.ARRAY:
        return this.pushAndReturnObject(this.getItems())

      case Type.BIGNUM:
        return this.pushAndReturnObject(this.getBignum())

      case Type.CLASS:
        return this.pushAndReturnObject(new RubyClass(this.getString()))

      case Type.MODULE:
        return this.pushAndReturnObject(new RubyModule(this.getString()))

      case Type.CLASS_OR_MODULE:
        return this.pushAndReturnObject(new RubyClassOrModule(this.getString()))

      case Type.DATA:
        return this.pushAndReturnObject(
          new RubyObject(this.getAny(), { data: this.getAny() })
        )

      case Type.FLOAT:
        return this.pushAndReturnObject(this.getFloat())

      case Type.HASH:
        return this.pushAndReturnObject(new RubyHash(this.getPairs()))

      case Type.HASH_WITH_DEFAULT_VALUE:
        return this.pushAndReturnObject(
          new RubyHash(this.getPairs(), this.getAny())
        )

      case Type.OBJECT:
        return this.pushAndReturnObject(
          new RubyObject(this.getAny(), { instanceVariables: this.getPairs() })
        )

      case Type.REGEXP:
        return this.pushAndReturnObject(this.getRegExp())

      case Type.STRING:
        return this.pushAndReturnObject(this.getString())

      case Type.STRUCT:
        return this.pushAndReturnObject(
          new RubyStruct(this.getAny(), this.getPairs())
        )

      case Type.USER_CLASS:
        return this.pushAndReturnObject(
          new RubyObject(this.getAny(), { wrapped: this.getAny() })
        )

      case Type.USER_DEFINED:
        return this.pushAndReturnObject(
          new RubyObject(this.getAny(), { userDefined: this.getChunk() })
        )

      case Type.USER_MARSHAL:
        return this.pushAndReturnObject(
          new RubyObject(this.getAny(), { userMarshal: this.getAny() })
        )
    }
  }
}

/**
 * Load one marshal section from buffer.
 *
 * If you need to load multiple times (like RGSS1), use `loadAll`.
 * @example
 * in node.js: load(fs.readFileSync('Scripts.rvdata2').buffer)
 * in browser: file.arrayBuffer().then(buffer => load(buffer))
 */
export function load(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  return new Parser(view).get()
}

/**
 * Load all marshal sections from buffer.
 */
export function loadAll(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const parser = new Parser(view)
  const result = []
  while (parser.hasNext()) {
    result.push(parser.get())
  }
  return result
}
