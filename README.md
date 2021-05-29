# @hyrious/marshal

Ruby marshal for the browser and Node.js.

## Install

```
npm i @hyrious/marshal
```

## Usage

```ts
import { dump, load } from '@hyrious/marshal'
dump(null) // ArrayBuffer { 04 08 30 }
load(Uint8Array.of(4, 8, 0x30).buffer) // null
```

### Ruby &harr; JavaScript

| ruby               | javascript                                     |
| ------------------ | ---------------------------------------------- |
| `nil`              | `null`                                         |
| `"string"`         | `"string"` (utf-8 only, no instance variables) |
| `:symbol`          | `Symbol.for('symbol')` (same above)            |
| `123456` (Integer) | `123456` (number)                              |
| `123.456` (Float)  | `123.456` (number)                             |
| `/cat/mixn`        | `/cat/im` (regexp, see comments below)         |

Note about **RegExp**:

JavaScript RegExp is different from Ruby Regexp. Only these flags are preserved:

| flag | meaning     |
| ---- | ----------- |
| `i`  | ignore case |
| `m`  | multi-line  |

### FAQ

**How to pass a `Buffer` in Node.js ?**

`buffer.buffer`.

**How to get a binary string from ArrayBuffer (and reverse back) ?**

You can use TextEncoder/TextDecoder. But please no, you won't expect a USVString at the most of the time.
All string/symbol in ruby will be converted to js string automatically.

**Do you support [Stream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) API ?**

Because the stream api in the browser and in node.js is not similar at all, it should be separated into 2 files and add `exports` respectively. I'm not in a hurry to implement this feature. If you really need this please make a pr/issue to let me know.

**Do you support [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) ?**

Currently not, but JavaScript's `number` is big enough to store up to `2^53 - 1`.

### Reference

- [Marshal Format](https://github.com/ruby/ruby/blob/master/doc/marshal.rdoc) (official doc)
- [node-marshal](https://github.com/clayzermk1/node-marshal)
- A [little](http://jakegoulding.com/blog/2013/01/15/a-little-dip-into-rubys-marshal-format)/[another](http://jakegoulding.com/blog/2013/01/16/another-dip-into-rubys-marshal-format)/[final](http://jakegoulding.com/blog/2013/01/20/a-final-dip-into-rubys-marshal-format) dip into Ruby's Marshal format

### Todo

- [Esbuild does not inline `const enum` now](https://github.com/evanw/esbuild/issues/128).

## License

MIT @ [hyrious](https://github.com/hyrious)
