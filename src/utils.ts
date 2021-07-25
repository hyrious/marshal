let decoder: TextDecoder | undefined;

/** get string from array buffer */
export function stringFromBuffer(buffer: ArrayBuffer) {
  return (decoder ??= new TextDecoder()).decode(buffer);
}

let encoder: TextEncoder | undefined;

/** convert string to (utf-8) array buffer */
export function bufferFromString(string: string) {
  return (encoder ??= new TextEncoder()).encode(string).buffer;
}

/** get string's utf-8 byte length */
export function stringByteLength(string: string) {
  return (encoder ??= new TextEncoder()).encode(string).byteLength;
}

/** convert `[[Symbol(a), 1]]` to `{ a: 1 }` */
export function objectFromPairs(pairs: [symbol, any][]) {
  const object: Record<string, any> = {};
  for (const [key, value] of pairs) {
    object[Symbol.keyFor(key)!] = value;
  }
  return object;
}

/** convert `{ a: 1 }` to `[[Symbol(a), 1]]` */
export function pairsFromObject(object: Record<string, any>) {
  const pairs: [symbol, any][] = [];
  for (const key of Object.keys(object)) {
    pairs.push([Symbol.for(key), object[key]]);
  }
  return pairs;
}

export function concatArrayBuffers(...args: ArrayBuffer[]) {
  if (args.length === 0) return undefined;
  const totalLength = args.reduce((a, b) => a + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let length = 0;
  for (let buffer of args) {
    result.set(new Uint8Array(buffer), length);
    length += buffer.byteLength;
  }
  return result.buffer;
}

export class ArrayBufferBuilder {
  #data = new Uint8Array(16);
  #length = 0;

  public get length() {
    return this.#length;
  }

  public get buffer() {
    return this.#data.buffer.slice(0, this.#length);
  }

  private resize() {
    const data = new Uint8Array(this.#data.byteLength << 1);
    data.set(this.#data);
    this.#data = data;
  }

  public appendString(string: string) {
    const array = (encoder ??= new TextEncoder()).encode(string);
    if (this.#length + array.byteLength > this.#data.byteLength) {
      this.resize();
    }
    this.#data.set(array, this.#length);
    this.#length += array.byteLength;
  }

  public appendArray(array: ArrayLike<number>) {
    if (this.#length + array.length > this.#data.byteLength) {
      this.resize();
    }
    this.#data.set(array, this.#length);
    this.#length += array.length;
  }
}
