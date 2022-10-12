# @hyrious/marshal

Ruby marshal for the browser and Node.js.

## Install

```
npm add @hyrious/marshal
```

## Usage

```ts
import { dump, load } from "@hyrious/marshal";
dump(null); // ArrayBuffer { 04 08 30 }
load(Uint8Array.of(4, 8, 0x30).buffer); // null

// in Node.js
load(fs.readFileSync("data").buffer);

// in Browser
load(await file.arrayBuffer());
```

### Ruby &harr; JavaScript

| Ruby                    | JavaScript                                         |
| ----------------------- | -------------------------------------------------- |
| `nil`                   | `null`                                             |
| `"string"`              | `"string"` (utf-8 only, no instance variables)     |
| `:symbol`               | `Symbol(symbol)` (same above)                      |
| `123456` (Integer)      | `123456` (number)                                  |
| `123.456` (Float)       | `123.456` (number)                                 |
| `/cat/im`               | `/cat/im` (RegExp)                                 |
| `[]`                    | `[]` (no instance variables)                       |
| `{}`                    | `RubyHash { entries: [] }` (same above)            |
| `Object.new`            | `RubyObject { className: Symbol(Object) }`         |
| `S = Struct.new; S.new` | `RubyStruct { className: Symbol(S), members: [] }` |
| `Object`                | `RubyClass { name: 'Object' }`                     |
| `Math`                  | `RubyModule { name: 'Math' }`                      |

#### String

Ruby string can store both utf-8 and binary data, this is not the same in JavaScript.
By default this library will always try to decode a ruby string to utf-8 js string.
You can call `load()` with `decodeString: false` to make it return an `ArrayBuffer`
if your input is binary data.

```js
// Marshal.dump("a")
let buffer = load(Uint8Array.of(4, 8, 73, 34, 6, 97, 6, 58, 6, 69, 84).buffer, {
  decodeString: false,
});
// => ArrayBuffer { 97 }
new TextDecoder().decode(buffer);
// => "a"
```

#### Symbol

You can use `Symbol.keyFor(sym)` to get a symbol's name in string.

#### RegExp

JavaScript RegExp is different from Ruby Regexp. Only these flags are preserved:

| flag | meaning     |
| ---- | ----------- |
| `i`  | ignore case |
| `m`  | multi-line  |

#### Hash

Ruby hash is more like JavaScript's `Map` instead of `{}`, but that may lose the keys' order.
So this library will return a `RubyHash` wrapper by default. You can call `load()` with
`hashToJS: true` to make it return a plain js object. There's also a `hashToMap`.

```js
// Marshal.dump({ a: 1 })
load(Uint8Array.of(4, 8, 123, 6, 58, 6, 97, 105, 6).buffer, {
  hashToJS: true,
});
// => { a: 1 }
```

### [API Reference](./docs/api.md)

### [FAQ](./docs/faq.md)

### Reference

- [marshal.c](https://github.com/ruby/ruby/blob/master/marshal.c)
- [Marshal Format](https://github.com/ruby/ruby/blob/master/doc/marshal.rdoc) (official doc)
- [node-marshal](https://github.com/clayzermk1/node-marshal)
- A [little](http://jakegoulding.com/blog/2013/01/15/a-little-dip-into-rubys-marshal-format)/[another](http://jakegoulding.com/blog/2013/01/16/another-dip-into-rubys-marshal-format)/[final](http://jakegoulding.com/blog/2013/01/20/a-final-dip-into-rubys-marshal-format) dip into Ruby's Marshal format

## License

MIT @ [hyrious](https://github.com/hyrious)
