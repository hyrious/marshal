import { S_DEFAULT, S_EXTENDS } from "./constants";

export const symKeys = Object.getOwnPropertySymbols;
export const defProp = Object.defineProperty;

const decoder = /* @__PURE__ */ new TextDecoder();
export const decode = (s: Uint8Array): string => decoder.decode(s);

const encoder = /* @__PURE__ */ new TextEncoder();
export const encode = (s: string): Uint8Array => encoder.encode(s);

export const define_extends = (o: unknown): symbol[] | undefined => {
  if (typeof o === "object" && o && !(o as any)[S_EXTENDS]) {
    var value: symbol[] = [];
    defProp(o, S_EXTENDS, { value, configurable: true });
    return value;
  }
  return o && (o as any)[S_EXTENDS];
};

export const define_hash_default = (h: {}, value: unknown) => {
  defProp(h, S_DEFAULT, { value, configurable: true });
};
