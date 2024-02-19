# Changelog

## 0.3.3

- Add `regexp: wrap` to wrap ruby regexp in `RubyRegexp`.

## 0.3.2

- Add `string: utf8 | binary` in `load()` to force decode or not decode strings.

## 0.3.1

- Fix `load(string)` should decode string in each code manually.

## 0.3.0

- :warning: BREAKING. Read the [API Reference](./docs/api.md) to learn the new API.

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
