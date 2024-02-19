# @hyrious/marshal

## Table of Contents

- [load(data, options?)](#loaddata-options)
  - [options.string: `"utf8"` | `"binary"`](#optionsstring-utf8--binary)
  - [options.numeric: `"wrap"`](#optionsnumeric-wrap)
  - [options.hashSymbolKeysToString: `true`](#optionshashsymbolkeystostring-true)
  - [options.hash: `"map"` | `"wrap"`](#optionshash-map--wrap)
  - [options.regexp: `"wrap"`](#optionsregexp-wrap)
  - [options.ivarToString: `true` | `string`](#optionsivartostring-true--string)
  - [options.known: `{ class }`](#optionsknown--class-)
- [dump(value, options?)](#dumpvalue-options)
  - [options.hashStringKeysToSymbol: `true`](#optionshashstringkeystosymbol-true)
  - [options.known: `{ class }`](#optionsknown--class--1)
  - [options.unknown: `(obj) => string`](#optionsunknown-obj--string)

## load(data, options?)

Parse a Ruby marshal data to a JavaScript value..

- `data` {string | Uint8Array | ArrayBuffer} The marshal data.
- `options` {Object} Parse options.

When the `data` is a string, it is firstly encoded into `Uint8Array`,
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

### options.string: `"utf8"` | `"binary"`

Force decode or not decode string values.

```rb
data = Marshal.dump(["foo", "foo".force_encoding("binary")])
```

```js
load(data); // => ["foo", Uint8Array(3) [ 102, 111, 111 ]]
load(data, { string: "utf8" }); // => ["foo", "foo"]
load(data, { string: "binary" }); // => [Uint8Array(3) [ 102, 111, 111 ], Uint8Array(3) [ 102, 111, 111 ]]
```

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

### options.hash: `"map"` \| `"wrap"`

Wrap ruby Hash in `Map` or the `RubyHash` class.
`hashSymbolKeysToString` is ignored when this option is set.

```rb
data = Marshal.dump({ a: 1 })
```

```js
load(data, { hash: "map" }); // => Map { Symbol(a) => 1 }
load(data, { hash: "wrap" }); // => RubyHash { entries: [[Symbol(a), 1]] }
```

### options.regexp: `"wrap"`

Wrap ruby Regexp in the `RubyRegexp` class so that you can read ruby specific flags.

```rb
data = Marshal.dump(/cat/mix)
```

```js
load(data); // => /cat/im
load(data, { regexp: "wrap" }); // => RubyRegexp { source: 'cat', options: 7 }
```

To test these flags, you can read the constants named `RE_*` from this library:

<samp>

| Constant      | Value |
| ------------- | ----- |
| RE_IGNORECASE | 1     |
| RE_EXTENDED   | 2     |
| RE_MULTILINE  | 4     |

</samp>

### options.ivarToString: `true` \| `string`

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

### options.known: `{ class }`

Decode Ruby objects as same-class JavaScript objects.

```rb
class A end
data = Marshal.dump(A.new)
```

```js
class A {}
load(data); // => RubyObject { class: Symbol(A) }
load(data, { known: { A } }); // => A {}
```

## dump(value, options?)

Encode a JavaScript value into Ruby marshal data. Returns a `Uint8Array`.
Note that the `Uint8Array` may not always be the same length as its underlying buffer.
You should always check the `byteOffset` and `byteLength` when accessing the buffer.

- `value` {unknown} The JavaScript value.
- `options` {Object} Encode options.

### options.hashStringKeysToSymbol: `true`

Convert string keys in hash to symbol.

```js
dump({ a: 1 }); // => ruby: { "a" => 1 }
dump({ a: 1 }, { hashStringKeysToSymbol: true }); // => ruby: { :a => 1 }
```

### options.known: `{ class }`

Encode JavaScript objects into same-name Ruby objects.

```js
class A {}
dump(new A()); // Error: can't dump object [object Object]
dump(new A(), { known: { A } }); // => ruby: #<A>
```

### options.unknown: `(obj) => string`

This is an alter to the error case of `options.known`.
It should returns a string indicating the Ruby class name to encode into.
If you return `null` or empty string, it fallbacks to throw the error.

```js
dump(new A(), { unknown: a => a.constructor?.name }); // => ruby: #<A>
```
