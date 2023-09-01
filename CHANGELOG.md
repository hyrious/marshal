# Changelog

## Unreleased

- **Breaking**

  - `dump()` now returns `Uint8Array` for better performance.
  - `Dumper` and `Loader` (formerly `Parser`) are hidden from the public API,
    because their properpties are mangled for smaller size.
  - Ruby `String` will always be wrapped in `RubyString` because it's contents
    can be binary data. There's no `wrapString` any more.

    Similar to `Symbol`s, this library will use `RubySymbol` instead of the native Symbol in JS.

    Similar to `Regexp`s, this library will use `RubyRegexp` instead of the native RegExp in JS.

    You can enable `decodeString: true` to get the previous behavior.

    ```js
    var a = load(data); //=> RubyString { contents, text }
    a.contents; //=> Uint8Array(1) [ 97 ]
    a.text; //=> "a", this is a computed property
    ```

  - Ruby `Integer` and `Float` still becomes JS `number`, but accepts a new option
    `wrapNumber: true` to wrap them in `RubyInteger` and `RubyFloat` respectively.

    ```js
    var a = load(data, { wrapNumber: true });
    a.type; //=> 'fixnum' or 'bignum' or 'float'
    a.isInteger; //=> boolean
    a.value; //=> 123
    ```

- `load()` now accepts `Uint8Array`.
- `dump()` now learns new options:

  - `knownClasses: { [className]: class }` to automatically dump JS objects into Ruby objects.

    Note that to generate instance variables, you have to set the `__ivars` property on the object.

    ```js
    class A {}
    var data = dump(
      Object.assign(new A(), {
        __ivars: [[Symbol.for("@a"), 1]],
      }),
      { knownClasses: { A } }
    );
    Marshal.load(data); //=> #<A @a=1>
    ```

  - If the object class is not in `knownClasses`, they will become ruby Hash, same as before.

- `Ruby*` classes now all have a `type` property to help reducing `instanceof` checks.

## 0.2.5

- `hashToJS` now also accepts number (Integer, Float) keys.

## 0.2.4

- Fix mutating default options.

## 0.2.3

- Add `clone(x, opt)` as a shortcut to `load(dump(x), opt)`.

## 0.2.2

- Fix `hashToJS`, `hashToMap` with nested hashes.

## 0.2.1

- Fix dump Bignum logic.
- Fix dump Hash with default value.
- Fix instance variables logic.
- Add `RubyRange`, `RubyTime` helper classes.

## 0.2.0

- Refactored a lot to make this package smaller.
- Fix `T_EXTENDED` parse and dump behavior.
- Support dump circular objects.

## 0.1.6

- esbuild has inline enum, this package can be smaller and run quicker.

## 0.1.5

- Changed `exports` field in package.json so that it always use ESM when bundling to browser.

## 0.1.4

- Fixed parsing circular objects.

## 0.1.3

- Added `load` option `decodeString: false` and `wrapString: true`

## 0.1.2

- Fixed `dump(new RubyObject())` generates wrong marshal data

## 0.1.0

- Added `load(arrayBuffer)` to parse marshal data
- Added `dump(value)` to dump marshal data (not strictly equal to the ruby ones)
