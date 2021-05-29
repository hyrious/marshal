import { RubyObject } from './ruby-object'

export function stringFromBuffer(buffer: ArrayBuffer) {
  return new TextDecoder().decode(buffer)
}

// eslint-disable-next-line unicorn/prevent-abbreviations
export function withIVar(object: any, pairs: [any, any][]) {
  if (object instanceof RubyObject) {
    object.instanceVariables = pairs
  }
  return object
}

export function extendsModule(object: any, module: Symbol) {
  if (object instanceof RubyObject) {
    object.extends = module
  }
  return object
}
