import {
  RubyClass,
  RubyClassOrModule,
  RubyHash,
  RubyHashWithDefaultValue,
  RubyModule,
  RubyObject,
  RubyStruct,
} from './ruby-object'
import { RegexpOption, Type } from './types'
// eslint-disable-next-line unicorn/prevent-abbreviations
import { extendsModule, stringFromBuffer, withIVar } from './utils'

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
        // eslint-disable-next-line unicorn/no-null
        return null
      case Type.FIXNUM:
        return this.getFixnum()
      case Type.SYMBOL: {
        const symbol = Symbol.for(stringFromBuffer(this.getChunk()))
        this.#symbols.push(symbol)
        return symbol
      }
      case Type.SYMBOL_REF:
        return this.#symbols[this.getFixnum()]
      case Type.OBJECT_REF:
        return this.#objects[this.getFixnum() - 1]
      case Type.IVAR: {
        let object = this.getAny()
        const count = this.getFixnum()
        const pairs: [any, any][] = []
        for (let index = 0; index < count; ++index) {
          const key = this.getAny()
          const value = this.getAny()
          if (key === Symbol.for('E')) continue
          pairs.push([key, value])
        }
        object =
          typeof object === 'string' || object instanceof RegExp
            ? object
            : withIVar(object, pairs)
        this.#objects.push(object)
        return object
      }
      case Type.EXTEND: {
        const module = this.getAny()
        let object = this.getAny()
        object = extendsModule(object, module)
        this.#objects.push(object)
        return object
      }
      case Type.ARRAY: {
        const count = this.getFixnum()
        const array = []
        for (let index = 0; index < count; ++index) {
          array.push(this.getAny())
        }
        this.#objects.push(array)
        return array
      }
      case Type.BIGNUM: {
        // prettier-ignore
        const sign = String.fromCharCode(this.view.getUint8(this.pos++)) as '+' | '-'
        const count = this.getFixnum() * 2
        const bytes = new Uint8Array(this.getBytes(count))
        let a = 0
        for (let index = 0; index < count; ++index) {
          a += bytes[index] * 2 ** (index * 8)
        }
        a = sign === '+' ? a : -a
        this.#objects.push(a)
        return a
      }
      case Type.CLASS: {
        const name = stringFromBuffer(this.getChunk())
        const klass = new RubyClass(name)
        this.#objects.push(klass)
        return klass
      }
      case Type.MODULE: {
        const name = stringFromBuffer(this.getChunk())
        const module = new RubyModule(name)
        this.#objects.push(module)
        return module
      }
      case Type.CLASS_OR_MODULE: {
        const name = stringFromBuffer(this.getChunk())
        const object = new RubyClassOrModule(name)
        this.#objects.push(object)
        return object
      }
      case Type.DATA: {
        const className: Symbol = this.getAny()
        const state = this.getAny()
        const object = new RubyObject(className)
        object.data = state
        this.#objects.push(object)
        return object
      }
      case Type.FLOAT: {
        const string = stringFromBuffer(this.getChunk())
        let object
        switch (string) {
          case 'inf':
            object = Number.POSITIVE_INFINITY
          case '-inf':
            object = Number.NEGATIVE_INFINITY
          case 'nan':
            object = Number.NaN
          default:
            object = Number(string)
        }
        this.#objects.push(object)
        return object
      }
      case Type.HASH: {
        const count = this.getFixnum()
        const pairs: [any, any][] = []
        for (let index = 0; index < count; ++index) {
          const key = this.getAny()
          const value = this.getAny()
          pairs.push([key, value])
        }
        const object = new RubyHash(pairs)
        this.#objects.push(object)
        return object
      }
      case Type.HASH_WITH_DEFAULT_VALUE: {
        const count = this.getFixnum()
        const pairs: [any, any][] = []
        for (let index = 0; index < count; ++index) {
          const key = this.getAny()
          const value = this.getAny()
          pairs.push([key, value])
        }
        const defaultValue = this.getAny()
        const object = new RubyHashWithDefaultValue(pairs, defaultValue)
        this.#objects.push(object)
        return object
      }
      case Type.OBJECT: {
        const className: Symbol = this.getAny()
        const object = new RubyObject(className)
        const count = this.getFixnum()
        for (let index = 0; index < count; ++index) {
          object.instanceVariables.push([this.getAny(), this.getAny()])
        }
        this.#objects.push(object)
        return object
      }
      case Type.REGEXP: {
        const source = stringFromBuffer(this.getChunk())
        const type = this.view.getUint8(this.pos++)
        let flags = ''
        if (type & RegexpOption.IGNORECASE) flags += 'i'
        if (type & RegexpOption.MULTILINE) flags += 'm'
        const regexp = new RegExp(source, flags)
        this.#objects.push(regexp)
        return regexp
      }
      case Type.STRING: {
        const string = stringFromBuffer(this.getChunk())
        this.#objects.push(string)
        return string
      }
      case Type.STRUCT: {
        const className: Symbol = this.getAny()
        const count = this.getFixnum()
        const pairs: [Symbol, any][] = []
        for (let index = 0; index < count; ++index) {
          const key = this.getAny()
          const value = this.getAny()
          pairs.push([key, value])
        }
        const object = new RubyStruct(className, pairs)
        this.#objects.push(object)
        return object
      }
      case Type.USER_CLASS: {
        const className: Symbol = this.getAny()
        const wrapped = this.getAny()
        const object = new RubyObject(className)
        object.wrapped = wrapped
        this.#objects.push(object)
        return object
      }
      case Type.USER_DEFINED: {
        const className: Symbol = this.getAny()
        const userDefined = this.getChunk()
        const object = new RubyObject(className)
        object.userDefined = userDefined
        this.#objects.push(object)
        return object
      }
      case Type.USER_MARSHAL: {
        const className: Symbol = this.getAny()
        const userMarshal = this.getAny()
        const object = new RubyObject(className)
        object.userMarshal = userMarshal
        this.#objects.push(object)
        return object
      }
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
