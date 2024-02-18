import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe, rb_load } from "./helper";

function dumps(
  value: unknown,
  opts: { pre?: string; post?: string } & marshal.DumpOptions = {},
): Promise<string> {
  return rb_load(marshal.dump(value, opts), opts.pre, opts.post);
}

describe("dump", test => {
  test("trivial value", async () => {
    assert.is(await dumps(null), "nil");
    assert.is(await dumps(true), "true");
    assert.is(await dumps(false), "false");
    assert.is(await dumps(0), "0");
    assert.is(await dumps([]), "[]");
    assert.is(await dumps({}), "{}");
  });

  test("number", async () => {
    assert.is(await dumps(42), "42");
    assert.is(await dumps(-42), "-42");
    assert.is(await dumps(114514), "114514");
    assert.is(await dumps(-1919810), "-1919810");
    assert.is(await dumps(1145141919810), "1145141919810");
    assert.is(await dumps(-11451419198), "-11451419198");
    assert.is(await dumps(123.456), "123.456");
    assert.is(await dumps(new marshal.RubyInteger(114514)), "114514");
    assert.is(await dumps(new marshal.RubyInteger(1145141919810)), "1145141919810");
    assert.is(await dumps(new marshal.RubyFloat(-0)), "-0.0");
    assert.is(await dumps(1 / 0), "Infinity");
    assert.is(await dumps(-1 / 0), "-Infinity");
    assert.is(await dumps(NaN), "NaN");
  });

  test("string", async () => {
    assert.is(await dumps("hello"), '"hello"');
    assert.is(await dumps(new TextEncoder().encode("hello")), '"hello"');
  });

  test("regexp", async () => {
    assert.is(await dumps(/hello/), "/hello/");
  });

  test("hash", async () => {
    assert.is(await dumps(new marshal.RubyHash([["a", 1]])), '{"a"=>1}');
    assert.is(await dumps(new Map([["a", 1]])), '{"a"=>1}');

    let a = new marshal.RubyHash([
      ["x", 1],
      ["x", 1],
    ]);
    assert.is(await dumps(a), '{"x"=>1}');
  });

  test("circular", async () => {
    let arr: any[] = [];
    arr.push(arr);
    assert.is(await dumps(arr), "[[...]]");

    let hash: marshal.Hash = {};
    hash[Symbol.for("a")] = hash;
    assert.is(await dumps(hash), "{:a=>{...}}");

    let obj = new marshal.RubyObject(Symbol.for("Object"));
    obj[Symbol.for("@a")] = obj;
    assert.match(await dumps(obj), /^(#<Object:0x[a-f0-9]+) @a=\1 ...>>$/);
  });

  test("extended", async () => {
    const pre = "class A end; module M end";
    const post = "print a.singleton_class.ancestors[0..1].inspect";

    let obj = new marshal.RubyObject(Symbol.for("A"));
    obj[marshal.S_EXTENDS] = [Symbol.for("M")];
    assert.match(await dumps(obj, { pre, post }), /^\[#<Class:#<A:0x[a-f0-9]+>>, M]/);

    obj[marshal.S_EXTENDS] = [Symbol.for("M"), Symbol.for("A")];
    assert.match(await dumps(obj, { pre, post }), /^\[M, #<Class:#<A:0x[a-f0-9]+>>]/);
  });

  test("hashStringKeysToSymbol", async () => {
    let obj = { a: 1, b: 2 };
    assert.is(await dumps(obj), '{"a"=>1, "b"=>2}');
    assert.is(await dumps(obj, { hashStringKeysToSymbol: true }), "{:a=>1, :b=>2}");
  });

  test("error on undefined", async () => {
    try {
      await dumps({ a: void 0 });
      assert.unreachable("should throw error");
    } catch (e) {
      assert.instance(e, TypeError);
      assert.match(e.message, /can't dump/);
    }
  });

  test("user class", async () => {
    let a = new marshal.RubyObject(Symbol.for("MyHash"));
    a[marshal.S_EXTENDS] = [Symbol.for("MyHash")];
    a.wrapped = {}; // a Hash
    assert.is(await dumps(a, { pre: "class MyHash < Hash; end", post: "print a.class" }), "MyHash");
  });

  test("user defined", async () => {
    let a = new marshal.RubyObject(Symbol.for("UserDefined"));
    a.userDefined = Uint8Array.of(42);
    const pre = `
      class UserDefined
        attr_accessor :a
        def self._load(data)
          obj = allocate
          obj.a = data
          obj
        end
      end
    `;
    const post = `print a.a`;
    assert.is(await dumps(a, { pre, post }), "*");
  });

  test("user marshal", async () => {
    let a = new marshal.RubyObject(Symbol.for("A"));
    a.userMarshal = []; // an Array
    const pre = "class A; def marshal_load(obj) print obj.inspect end end";
    assert.is(await dumps(a, { pre, post: "" }), "[]");
  });

  test("known", async () => {
    class A {}
    let a = new A();
    try {
      a[marshal.S_EXTENDS] = [Symbol.for("A")];
      await dumps(a);
      assert.unreachable("should throw error");
    } catch (e) {
      assert.instance(e, TypeError);
      assert.match(e.message, /can't dump/);
    }
    let pre = "class A end";
    assert.match(await dumps(a, { pre, known: { A } }), /^#<A:0x[a-f0-9]+>$/);
    assert.match(await dumps(a, { pre, unknown: a => a?.constructor?.name }), /^#<A:0x[a-f0-9]+>$/);
  });

  test("struct", async () => {
    let a = new marshal.RubyStruct(Symbol.for("A"));
    a.members = { [Symbol.for("a")]: 1 };
    assert.is(await dumps(a, { pre: "A = Struct.new :a" }), "#<struct A a=1>");
  });

  test("class and module", async () => {
    assert.is(await dumps(new marshal.RubyClass("A"), { pre: "class A end" }), "A");
    assert.is(await dumps(new marshal.RubyModule("A"), { pre: "module A end" }), "A");
  });

  test("range", async () => {
    assert.is(await dumps(new marshal.RubyRange(1, 10, true)), "1...10");
  });
});
