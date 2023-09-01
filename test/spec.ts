import * as marshal from "../src";
import * as assert from "uvu/assert";
import { describe, dump_a } from "./helper";
import { encodeUTF8 } from "../src/utils";

// https://github.com/ruby/ruby/blob/master/spec/ruby/core/marshal/dump_spec.rb
describe("spec.dump", test => {
  test("nil", () => {
    assert.equal(dump_a(null), [4, 8, 48]);
  });

  test("true", () => {
    assert.equal(dump_a(true), [4, 8, 84]);
  });

  test("false", () => {
    assert.equal(dump_a(false), [4, 8, 70]);
  });

  test("Fixnum", () => {
    // prettier-ignore
    const cases: [number, number[]][] = [
      [  0,       [4, 8, 105, 0]],
      [  5,       [4, 8, 105, 10]],
      [  8,       [4, 8, 105, 13]],
      [  122,     [4, 8, 105, 127]],
      [  123,     [4, 8, 105, 1, 123]],
      [  1234,    [4, 8, 105, 2, 210, 4]],
      [- 8,       [4, 8, 105, 243]],
      [- 123,     [4, 8, 105, 128]],
      [- 124,     [4, 8, 105, 255, 132]],
      [- 1234,    [4, 8, 105, 254, 46, 251]],
      [- 4516727, [4, 8, 105, 253, 137, 20, 187]],
      [  2**8,    [4, 8, 105, 2, 0, 1]],
      [  2**16,   [4, 8, 105, 3, 0, 0, 1]],
      [  2**24,   [4, 8, 105, 4, 0, 0, 0, 1]],
      [-(2**8),   [4, 8, 105, 255, 0]],
      [-(2**16),  [4, 8, 105, 254, 0, 0]],
      [-(2**24),  [4, 8, 105, 253, 0, 0, 0]],
    ];
    for (const [left, right] of cases) {
      assert.equal(dump_a(left), right, `dump(${left}) failed, expect ${right}`);
    }
  });

  test("Bignum", () => {
    assert.equal(dump_a(2 ** 31 + 1), [4, 8, 108, 43, 7, 1, 0, 0, 128]);
    assert.equal(dump_a(-(2 ** 31) - 1), [4, 8, 108, 45, 7, 1, 0, 0, 128]);
  });

  const bytes = (str: string) => str.split("").map(c => c.charCodeAt(0));

  test("Symbol", () => {
    assert.equal(dump_a(Symbol.for("symbol")), [4, 8, 58, 11, 115, 121, 109, 98, 111, 108]);
    {
      const result = [4, 8, 58, 2, 44, 1];
      for (let i = 0; i < 100; ++i) result.push(...bytes("big"));
      assert.equal(dump_a(Symbol.for("big".repeat(100))), result);
    }
  });

  test("marshal_dump", () => {
    const obj = marshal.makeUserMarshal(Symbol.for("UserMarshal"), Symbol.for("data"));
    assert.equal(
      dump_a(obj),
      [4, 8, 85, 58, 16, 85, 115, 101, 114, 77, 97, 114, 115, 104, 97, 108, 58, 9, 100, 97, 116, 97]
    );
  });

  const n_bytes = (str: string) => [str.length + 5, ...bytes(str)];
  const symbol = (s: string) => [58, s.length + 5, ...bytes(s)];

  test("_dump", () => {
    const obj = marshal.makeUserDefined(
      Symbol.for("UserDefined"),
      marshal.dump([Symbol.for("stuff"), Symbol.for("stuff")])
    );
    assert.equal(dump_a(obj), [4, 8, 117, ...symbol("UserDefined"), 13 + 5, ...obj.contents]);
  });

  test("Class", () => {
    assert.equal(dump_a(marshal.makeClass(encodeUTF8("String"))), [4, 8, 99, ...n_bytes("String")]);
    assert.equal(dump_a(marshal.makeClass(encodeUTF8("UserDefined::Nested"))), [
      4,
      8,
      99,
      ...n_bytes("UserDefined::Nested"),
    ]);
  });

  test("Module", () => {
    assert.equal(dump_a(marshal.makeModule(encodeUTF8("Marshal"))), [4, 8, 109, ...n_bytes("Marshal")]);
  });

  test("Float", () => {
    // prettier-ignore
    const cases: [number, number[]][] = [
      [  123.4567,   [4, 8, 102, ...n_bytes("123.4567")]],
      [ -0.841,      [4, 8, 102, ...n_bytes("-0.841")]],
      [ -9876.345,   [4, 8, 102, ...n_bytes("-9876.345")]],
      [ +Infinity,   [4, 8, 102, ...n_bytes("inf")]],
      [ -Infinity,   [4, 8, 102, ...n_bytes("-inf")]],
      [  NaN,        [4, 8, 102, ...n_bytes("nan")]],
    ];
    for (const [left, right] of cases) {
      assert.equal(dump_a(left), right, `dump(${left}) failed, expect ${right}`);
    }
  });

  test("String", () => {
    assert.equal(dump_a(""), [4, 8, 34, 0]);
    assert.equal(dump_a("short"), [4, 8, 34, ...n_bytes("short")]);
    assert.equal(dump_a("big".repeat(100)), [4, 8, 34, 2, 44, 1, ...bytes("big".repeat(100))]);
  });

  test("Regexp", () => {
    assert.equal(dump_a(/\A.\Z/), [4, 8, 47, 10, 92, 65, 46, 92, 90, 0]);
    // empty RegExp (//) will be converted to /(?:)/ in JavaScript
    assert.equal(dump_a(new RegExp("", "im")), [4, 8, 47, 9, 40, 63, 58, 41, 5]);
  });

  test("Array", () => {
    assert.equal(dump_a([]), [4, 8, 91, 0]);
    {
      const obj = marshal.makeWrapped(Symbol.for("UserArray"), []);
      assert.equal(dump_a(obj), [4, 8, 67, 58, 14, 85, 115, 101, 114, 65, 114, 114, 97, 121, 91, 0]);
    }
    {
      const a: any[] = [];
      a.push(a);
      assert.equal(dump_a(a), [4, 8, 91, 6, 64, 0]);
    }
  });

  test("Hash", () => {
    assert.equal(dump_a({}), [4, 8, 123, 0]);
    {
      const obj = marshal.makeWrapped(Symbol.for("UserHash"), {});
      assert.equal(dump_a(obj), [4, 8, 67, 58, 13, 85, 115, 101, 114, 72, 97, 115, 104, 123, 0]);
    }
    {
      const hash = marshal.makeHash([], 1);
      assert.equal(dump_a(hash), [4, 8, 125, 0, 105, 6]);
    }
  });

  const integer = (i: number) => [105, i + 5];

  test("Struct", () => {
    const obj = marshal.makeStruct(Symbol.for("Struct::Pyramid"), []);
    assert.equal(dump_a(obj), [4, 8, 83, 58, ...n_bytes("Struct::Pyramid"), 0]);

    {
      obj.class = Symbol.for("Struct::Useful");
      obj.members = [
        [Symbol.for("a"), 1],
        [Symbol.for("b"), 2],
      ];
      assert.equal(dump_a(obj), [
        4,
        8,
        83,
        58,
        ...n_bytes("Struct::Useful"),
        2 + 5,
        ...symbol("a"),
        ...integer(1),
        ...symbol("b"),
        ...integer(2),
      ]);
    }
  });

  test("Object", () => {
    const obj = marshal.makeObject(Symbol.for("Object"));
    assert.equal(dump_a(obj), [4, 8, 111, 58, 11, 79, 98, 106, 101, 99, 116, 0]);

    {
      marshal.pushExtends(obj, Symbol.for("Meths"));
      assert.equal(
        dump_a(obj),
        [4, 8, 101, 58, 10, 77, 101, 116, 104, 115, 111, 58, 11, 79, 98, 106, 101, 99, 116, 0]
      );
    }

    {
      delete (obj as marshal.RubyExtends).__extends;
      marshal.pushIvars(obj, [Symbol.for("@ivar"), 1]);
      assert.equal(
        dump_a(obj),
        [4, 8, 111, 58, 11, 79, 98, 106, 101, 99, 116, 6, 58, 10, 64, 105, 118, 97, 114, 105, 6]
      );
    }

    {
      (obj as marshal.RubyIVars).__ivars!.length = 0;
      assert.equal(dump_a(obj), [4, 8, 111, 58, 11, 79, 98, 106, 101, 99, 116, 0]);
    }

    {
      const sym = Symbol.for("a");
      assert.equal(dump_a([sym, sym]), [4, 8, 91, 7, 58, 6, 97, 59, 0]);
      assert.equal(dump_a([obj, obj]), [4, 8, 91, 7, 111, 58, 11, 79, 98, 106, 101, 99, 116, 0, 64, 6]);
    }
  });
});
