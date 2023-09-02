# @hyrious/marshal

![version](https://img.shields.io/npm/v/%40hyrious/marshal)
![npm package size](https://img.shields.io/bundlephobia/min/%40hyrious/marshal)
![downloads](https://img.shields.io/npm/dw/%40hyrious/marshal)

Ruby marshal for the browser and Node.js.

## Install

```
npm add @hyrious/marshal
```

## Usage

```ts
import { dump, load } from "@hyrious/marshal";
dump(null); // Uint8Array(3) [ 4, 8, 48 ]
load(Uint8Array.of(4, 8, 48)); // null

// in Node.js
load(fs.readFileSync("data"));

// in Browser
load(await file.arrayBuffer());
```

### [ChangeLog](./CHANGELOG.md)

### Develop

- Run `npm t` to run tests.
- Run `npm t clone` to only run `clone.ts`.

### Reference

- [marshal.c](https://github.com/ruby/ruby/blob/master/marshal.c)
- [Marshal Format](https://github.com/ruby/ruby/blob/master/doc/marshal.rdoc) (official doc)
- [node marshal](https://github.com/clayzermk1/node-marshal)
- [@qnighy/marshal](https://github.com/qnighy/marshal-js)
- A [little](http://jakegoulding.com/blog/2013/01/15/a-little-dip-into-rubys-marshal-format)/[another](http://jakegoulding.com/blog/2013/01/16/another-dip-into-rubys-marshal-format)/[final](http://jakegoulding.com/blog/2013/01/20/a-final-dip-into-rubys-marshal-format) dip into Ruby's Marshal format

## License

MIT @ [hyrious](https://github.com/hyrious)
