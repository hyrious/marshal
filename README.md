# @hyrious/marshal

Ruby marshal for the browser and node.js

## Install

```
npm i @hyrious/marshal
```

## Usage

```ts
import Marshal from '@hyrious/marshal'
Marshal.dump(null) // <Buffer 04 08 30>
Marshal.load(Uint8Array.of(4, 8, 0x30)) // null
```

## Reference

- [node-marshal](https://github.com/clayzermk1/node-marshal)
- A [little](http://jakegoulding.com/blog/2013/01/15/a-little-dip-into-rubys-marshal-format)/[another](http://jakegoulding.com/blog/2013/01/16/another-dip-into-rubys-marshal-format)/[final](http://jakegoulding.com/blog/2013/01/20/a-final-dip-into-rubys-marshal-format) dip into Ruby's Marshal format

## License

MIT @ [hyrious](https://github.com/hyrious)
