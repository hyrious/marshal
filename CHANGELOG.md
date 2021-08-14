# Changelog

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
