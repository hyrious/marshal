# Changelog

## [Unreleased]

## [0.1.3]

### Added

- `load` option `decodeString: false` and `wrapString: true`

## [0.1.2] - 2021-05-30

### Fixed

- `dump(new RubyObject())` generates wrong marshal data

## [0.1.0] - 2021-05-30

### Added

- `load(arrayBuffer)` to parse marshal data
- `dump(value)` to dump marshal data (not strictly equal to the ruby ones)

[unreleased]: https://github.com/hyrious/marshal/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/hyrious/marshal/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/hyrious/marshal/compare/0.1.0...v0.1.2
[0.1.0]: https://github.com/hyrious/marshal/releases/tag/0.1.0
