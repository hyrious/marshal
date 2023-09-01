// This file will be modified to return number literals.
// See ../scripts/plugins/constants.ts

export const T_TRUE = "T".charCodeAt(0);
export const T_FALSE = "F".charCodeAt(0);
export const T_NIL = "0".charCodeAt(0);
export const T_FIXNUM = "i".charCodeAt(0);
export const T_SYMBOL = ":".charCodeAt(0);
export const T_SYMLINK = ";".charCodeAt(0);
export const T_LINK = "@".charCodeAt(0);
export const T_IVAR = "I".charCodeAt(0);
export const T_EXTENDED = "e".charCodeAt(0);
export const T_ARRAY = "[".charCodeAt(0);
export const T_BIGNUM = "l".charCodeAt(0);
export const T_CLASS = "c".charCodeAt(0);
export const T_MODULE = "m".charCodeAt(0);
export const T_MODULE_OLD = "M".charCodeAt(0);
export const T_DATA = "d".charCodeAt(0);
export const T_FLOAT = "f".charCodeAt(0);
export const T_HASH = "{".charCodeAt(0);
export const T_HASH_DEF = "}".charCodeAt(0);
export const T_OBJECT = "o".charCodeAt(0);
export const T_REGEXP = "/".charCodeAt(0);
export const T_STRING = '"'.charCodeAt(0);
export const T_STRUCT = "S".charCodeAt(0);
export const T_UCLASS = "C".charCodeAt(0);
export const T_USERDEF = "u".charCodeAt(0);
export const T_USERMARSHAL = "U".charCodeAt(0);

export const RE_IGNORECASE = 1;
export const RE_EXTEND = 2;
export const RE_MULTILINE = 4;
// Note: there may be more flags, we should keep them

export const B_POSITIVE = "+".charCodeAt(0);
export const B_NEGATIVE = "-".charCodeAt(0);
