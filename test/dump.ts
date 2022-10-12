import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe, dumps } from "./helper";

describe("dump", test => {
  test("trivial value", async () => {
    assert.is(await dumps(null), "nil");
    assert.is(await dumps(true), "true");
    assert.is(await dumps(false), "false");
    assert.is(await dumps(0), "0");
    assert.is(await dumps([]), "[]");
    assert.is(await dumps(new marshal.RubyHash([])), "{}");
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

    let hash: Record<string, any> = {};
    hash.a = hash;
    assert.is(await dumps(hash), "{:a=>{...}}");

    let obj = new marshal.RubyObject(Symbol.for("Object"));
    obj.instanceVariables = [[Symbol.for("@a"), obj]];
    assert.match(await dumps(obj), /^(#<Object:0x[a-f0-9]+) @a=\1 ...>>$/);
  });

  test("extended", async () => {
    const preamble = "class A end; module M end";
    const code = "p a.singleton_class.ancestors[0..1]";

    let obj = new marshal.RubyObject(Symbol.for("A"), { extends: [Symbol.for("M")] });
    obj.instanceVariables = [];
    assert.match(await dumps(obj, preamble, code), /^\[#<Class:#<A:0x[a-f0-9]+>>, M]/);

    obj.extends = [Symbol.for("M"), Symbol.for("A")];
    assert.match(await dumps(obj, preamble, code), /^\[M, #<Class:#<A:0x[a-f0-9]+>>]/);
  });
});
