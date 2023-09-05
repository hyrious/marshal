# @hyrious/marshal

## Table of Contents

- [load(data, options?)](#loaddata-options)

## load(data, options?)

Parse a Ruby marshal data to a JavaScript value.

- `data` {string | Uint8Array | ArrayBuffer} The marshal data.
- `options` {Object} Parse options.

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
