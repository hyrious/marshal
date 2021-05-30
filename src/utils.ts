import { RubyObject } from './ruby'

let decoder: TextDecoder | undefined

/** use TextDecoder to get string from array buffer */
export function stringFromBuffer(buffer: ArrayBuffer) {
  return (decoder ??= new TextDecoder()).decode(buffer)
}

let encoder: TextEncoder | undefined

/** convert string to (utf-8) array buffer */
export function bufferFromString(string: string) {
  return (encoder ??= new TextEncoder()).encode(string).buffer
}

export function withIVar(object: any, pairs: [any, any][]) {
  if (object instanceof RubyObject) {
    object.instanceVariables = pairs
  }
  // note: some object's ivars are omitted here
  //       like string, regexp, array, etc
  return object
}

export function withMod(object: any, module: Symbol) {
  if (object instanceof RubyObject) {
    object.extends = module
  }
  return object
}
