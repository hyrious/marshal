export const enum Type {
  TRUE = 'T',
  FALSE = 'F',
  NIL = '0',
  FIXNUM = 'i',
  SYMBOL = ':',
  SYMBOL_REF = ';',
  OBJECT_REF = '@',
  IVAR = 'I',
  EXTEND = 'e',
  ARRAY = '[',
  BIGNUM = 'l',
  CLASS = 'c',
  MODULE = 'm',
  CLASS_OR_MODULE = 'M',
  DATA = 'd',
  FLOAT = 'f',
  HASH = '{',
  HASH_WITH_DEFAULT_VALUE = '}',
  OBJECT = 'o',
  REGEXP = '/',
  STRING = '"',
  STRUCT = 'S',
  USER_CLASS = 'C',
  USER_DEFINED = 'u',
  USER_MARSHAL = 'U',
}

export const enum RegexpOption {
  IGNORECASE = 1,
  MULTILINE = 4,
}

export const enum BignumSign {
  POSITIVE = 43, // '+'
  NEGATIVE = 45, // '-'
}
