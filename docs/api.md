# @hyrious/marshal

## Table of Contents

- [load(data, options?)](#loaddata-options)
  - [options.numeric: `"wrap"`](#optionsnumeric-wrap)
  - [options.hashSymbolKeysToString: `true`](#optionshashsymbolkeystostring-true)
  - [options.hash: `"map"` | `"wrap"`](#optionshash-map--wrap)
  - [options.ivarToString: `true` | `string`](#optionsivartostring-true--string)
- [dump(value, options?)](#dumpvalue-options)

## load(data, options?)

Parse a Ruby marshal data to a JavaScript value..

- `data` {string | Uint8Array | ArrayBuffer} The marshal data.
- `options` {Object} Parse options.

When the `data` is a string, it is firstly encoded into `Uint8Array` using `TextEncoder`,
this should give you a convenience to use this function like in Ruby:

```js
load("\x04\b0"); //=> null
```

Note that the string escaping is not exactly the same as Ruby:

<samp>

| hex code | Ruby | JavaScript |
| -------- | ---- | ---------- |
| 0x07     | \a   | \x07       |
| 0x0B     | \v   | \x0B       |
| 0x1B     | \e   | \x1B       |

</samp>

### options.numeric: `"wrap"`

Wrap numeric values (Integer and Float) in `RubyInteger` and `RubyFloat` classes.

```rb
data = Marshal.dump(0.0)
```

```js
load(data); // => 0
load(data, { numeric: "wrap" }); // => RubyFloat { value: 0 }
```

### options.hashSymbolKeysToString: `true`

Convert symbol keys in hash to string.

```rb
data = Marshal.dump({ a: 1 })
```

```js
load(data); // => { Symbol(a): 1 }
load(data, { hashSymbolKeysToString: true }); // => { a: 1 }
```

### options.hash: `"map"` | `"wrap"`

Wrap ruby Hash in `Map` or the `RubyHash` class.
`hashSymbolKeysToString` is ignored when this option is set.

```rb
data = Marshal.dump({ a: 1 })
```

```js
load(data, { hash: "map" }); // => Map { Symbol(a) => 1 }
load(data, { hash: "wrap" }); // => RubyHash { entries: [[Symbol(a), 1]] }
```

### options.ivarToString: `true` | `string`

Convert instance variable names to string props in JS objects.

```rb
a = Object.new
a.instance_variable_set :@a, 1
data = Marshal.dump(a)
```

```js
load(data); // => RubyObject { Symbol(@a): 1 }
load(data, { ivarToString: true }); // => RubyObject { "@a": 1 }
load(data, { ivarToString: "" }); // => RubyObject { "a": 1 }
load(data, { ivarToString: "_" }); // => RubyObject { "_a": 1 }
```

## dump(value, options?)

Encode a JavaScript value into Ruby marshal data. Returns a `Uint8Array`.
Note that the `Uint8Array` may not always be the same length as its underlying buffer.
You should always check the `byteOffset` and `byteLength` when accessing the buffer.

- `value` {unknown} The JavaScript value.
- `options` {Object} Encode options.
