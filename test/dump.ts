import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe, rb_load } from "./helper";

function dumps(
  value: unknown,
  opts: { pre?: string; post?: string } & marshal.DumpOptions = {}
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
    assert.is(await dumps(114514), "114514");
    assert.is(await dumps(-1919810), "-1919810");
    assert.is(await dumps(1145141919810), "1145141919810");
    assert.is(await dumps(123.456), "123.456");
  });

  test("string", async () => {
    assert.is(await dumps("hello"), '"hello"');
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

  test("known", async () => {
    class A {}
    try {
      await dumps(new A());
      assert.unreachable("should throw error");
    } catch (e) {
      assert.instance(e, TypeError);
      assert.match(e.message, /can't dump/);
    }
    let pre = "class A end";
    assert.match(await dumps(new A(), { pre, known: { A } }), /^#<A:0x[a-f0-9]+>$/);
    assert.match(await dumps(new A(), { pre, unknown: a => a?.constructor?.name }), /^#<A:0x[a-f0-9]+>$/);
  });
});
