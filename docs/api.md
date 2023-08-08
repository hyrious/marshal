# @hyrious/marshal

## Table of Contents

- [load(buffer, options?)](#loadbuffer-options)
- [loadAll(buffer, options?)](#loadallbuffer-options)
- [dump(value)](#dumpbuffer)
- [dumpAll(values)](#dumpallvalues)

## load(buffer, options?)

Parse a Ruby marshal data to a JavaScript value.

- `buffer` {ArrayBuffer} The marshal data.
- `options` {Object} Parse options:

  - `decodeString` {Boolean} Whether to decode a Ruby string to UTF-8 JavaScript String.
    If `false`, the parser will return `ArrayBuffer` for these Ruby strings.
    Default: `true`.

  - `wrapString` {Boolean} Whether to wrap the Ruby string in a `RubyString` class.
    This options only works when `decodeString` is `false`.
    Default: `false`.

  - `hashToJS` {Boolean} Whether to convert the Ruby hash to a JavaScript object.
    Because Ruby hash is ordered and its keys can be any type, the parser returns a `RubyHash` wrapper by default.
    If `true`, be care that the Ruby hash keys must be a string or a symbol or a number. Otherwise a `TypeError` will be thrown.
    Default: `false`.

  - `hashToMap` {Boolean} Similar to `hashToJS`, this options will convert the Ruby hash to a JavaScript Map object.
    The Ruby hash keys can be any value. But still be careful that the order is lost.
    Default: `false`.

**Example**

```js
load(Uint8Array.of(4, 8, 0x30).buffer); // null
```

## loadAll(buffer, options?)

Parse all marshal data in one buffer and returns an array of JavaScript values.

- `buffer` {ArrayBuffer} The marshal data.
- `options` {Object} Parse options, see [load(buffer, options?)](#loadbuffer-options).

## dump(value)

Dump a JavaScript value to a Ruby marshal data.

**Example**

```js
dump(null); // ArrayBuffer { 04 08 30 }
```

## dumpAll(values)

Dump all JavaScript values to a Ruby marshal data.
