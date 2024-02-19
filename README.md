# @hyrious/marshal

![version](https://img.shields.io/npm/v/%40hyrious/marshal)
![npm package size](https://img.shields.io/bundlephobia/min/%40hyrious/marshal)
![downloads](https://img.shields.io/npm/dw/%40hyrious/marshal)

Ruby marshal for the browser and Node.js.

## Install

```
npm add @hyrious/marshal
```

## Usage

```ts
import { dump, load } from "@hyrious/marshal";
dump(null); // Uint8Array(3) [ 4, 8, 48 ]
load("\x04\b0"); // null

// in Node.js
load(fs.readFileSync("data"));

// in Browser
load(await file.arrayBuffer());
```

### Ruby &harr; JavaScript

| Ruby         | JavaScript                             |
| ------------ | -------------------------------------- |
| `nil`        | `null`                                 |
| `"string"`   | `"string"`                             |
| `:symbol`    | `Symbol("symbol")`                     |
| `123456`     | `123456` (number)                      |
| `123.456`    | `123.456` (number)                     |
| `/cat/im`    | `/cat/im` (RegExp)                     |
| `[]`         | `[]`                                   |
| `{}`         | `{}` (plain object)                    |
| `Object.new` | `RubyObject { class: Symbol(object) }` |

#### String

Because users may store binary data that cannot be decoded as UTF-8 in Ruby,
strings are decoded into `Uint8Array` firstly, then converted to `string`
using `TextDecoder` if seeing an instance variable indicating the encoding.

```js
load('\x04\b"\0'); //=> Uint8Array []
load('\x04\bI"\0\x06:\x06ET'); //=> ""
```

The special instance variables are:

| name        | value        | encoding      |
| ----------- | ------------ | ------------- |
| `:E`        | true / false | UTF-8 / ASCII |
| `:encoding` | "enc"        | enc           |

So for strict compatibility, you should check if a string is Uint8Array before using it:

```js
var a = load(data);
if (a instanceof Uint8Array) a = decode(a); // if you know it must be a string
if (typeof a === "string") do_something(a);
```

Or you can use `options.string` to control the behavior, see [options.string](./docs/api.md#optionsstring-utf8--binary).

#### Symbols

Symbols are always decoded in UTF-8 even if they may have other encodings.
You can use `Symbol.keyFor(sym)` in JavaScript to get the symbol name in string.

#### RegExp

Only `i` (ignore case) and `m` (multi-line) flags are preserved.
However, it is still possible to read all flags by wrapper class, see [options.regexp](./docs/api.md#optionsregexp-wrap).

#### Hash

This library decodes Hash as plain object by default, string/symbol/number
keys are always decoded as JS object props, which means unusual keys like
an object are ignored. However, it is still possible to keep these keys
using `Map` or wrapper classes, see [options.hash](./docs/api.md#optionshash-map--wrap).

#### Instance Variables

This library decodes instance variables (often `@a = 1`) as object props, i.e. `obj[Symbol(@a)] = 1`.
It is guaranteed that you can retrieve these properties using `Object.getOwnPropertySymbols()`.
It is possible to convert these symbols to strings, see [options.ivarToString](./docs/api.md#optionsivartostring-true--string).

### [API Reference](./docs/api.md)

### [FAQ](./docs/faq.md)

### [ChangeLog](./CHANGELOG.md)

### Develop

- Run `npm t` to run tests.
- Run `npm t clone` to only run `clone.ts`.

### Reference

- [marshal.c](https://github.com/ruby/ruby/blob/master/marshal.c)
- [Marshal Format](https://github.com/ruby/ruby/blob/master/doc/marshal.rdoc) (official doc)
- [node marshal](https://github.com/clayzermk1/node-marshal)
- [@qnighy/marshal](https://github.com/qnighy/marshal-js)
- A [little](http://jakegoulding.com/blog/2013/01/15/a-little-dip-into-rubys-marshal-format)/[another](http://jakegoulding.com/blog/2013/01/16/another-dip-into-rubys-marshal-format)/[final](http://jakegoulding.com/blog/2013/01/20/a-final-dip-into-rubys-marshal-format) dip into Ruby's Marshal format

## License

MIT @ [hyrious](https://github.com/hyrious)
