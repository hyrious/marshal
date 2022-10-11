import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe, rubyMarshalLoad } from "./helper";

describe("dump", test => {
  test("trivial value", async () => {
    assert.is(await rubyMarshalLoad(marshal.dump(null)), "nil");
    assert.is(await rubyMarshalLoad(marshal.dump(true)), "true");
    assert.is(await rubyMarshalLoad(marshal.dump(false)), "false");
    assert.is(await rubyMarshalLoad(marshal.dump(0)), "0");
    assert.is(await rubyMarshalLoad(marshal.dump([])), "[]");
    assert.is(await rubyMarshalLoad(marshal.dump(new marshal.RubyHash([]))), "{}");
  });

  test("number", async () => {
    assert.is(await rubyMarshalLoad(marshal.dump(114514)), "114514");
    assert.is(await rubyMarshalLoad(marshal.dump(-1919810)), "-1919810");
    assert.is(await rubyMarshalLoad(marshal.dump(1145141919810)), "1145141919810");
    assert.is(await rubyMarshalLoad(marshal.dump(123.456)), "123.456");
  });

  test("string", async () => {
    assert.is(await rubyMarshalLoad(marshal.dump("hello")), '"hello"');
  });

  test("circular", async () => {
    let arr: any[] = [];
    arr.push(arr);
    assert.is(await rubyMarshalLoad(marshal.dump(arr)), "[[...]]");

    let hash: Record<string, any> = {};
    hash.a = hash;
    assert.is(await rubyMarshalLoad(marshal.dump(hash)), "{:a=>{...}}");

    let obj = new marshal.RubyObject(Symbol.for("Object"));
    obj.instanceVariables = [[Symbol.for("@a"), obj]];
    assert.match(await rubyMarshalLoad(marshal.dump(obj)), /^(#<Object:0x[a-f0-9]+) @a=\1 ...>>$/);
  });

  test("extended", async () => {
    let obj = new marshal.RubyObject(Symbol.for("A"));
    obj.extends = [Symbol.for("M")];
    assert.is(
      await rubyMarshalLoad(
        marshal.dump(obj),
        "class A end; module M end",
        "p a.singleton_class.ancestors[1]"
      ),
      "M"
    );

    obj.extends = [Symbol.for("M"), Symbol.for("A")];
    assert.match(
      await rubyMarshalLoad(
        marshal.dump(obj),
        "class A end; module M end",
        "p a.singleton_class.ancestors[0..1]"
      ),
      /^\[M, #<Class:#<A:0x[a-f0-9]+>>]/
    );
  });
});
