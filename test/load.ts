import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe, loads } from "./helper";

describe("parse", test => {
  test("trivial value", async () => {
    assert.is(await loads(`nil`), null);
    assert.is(await loads(`true`), true);
    assert.is(await loads(`false`), false);
    assert.is(await loads(`0`), 0);
    assert.equal(await loads(`[]`), []);
    assert.instance(await loads(`{}`), marshal.RubyHash);
  });

  test("number", async () => {
    assert.is(await loads(`114514`), 114514);
    assert.is(await loads(`-1919810`), -1919810);
    assert.is(await loads(`1145141919810`), 1145141919810);
    assert.is(await loads(`123.456`), 123.456); // please, don't compare float
  });

  test("string", async () => {
    const repeat = (Math.random() * 100) | 0;
    assert.is(await loads(`'a' * ${repeat}`), "a".repeat(repeat));
  });

  test("extended", async () => {
    let obj1: marshal.RubyObject = await loads(`module M end; class A end; a = A.new; a.extend M; a`);
    assert.is(obj1.className, Symbol.for("A"));
    assert.equal(obj1.extends, [Symbol.for("M")]);

    let obj2: marshal.RubyObject = await loads(
      `module M end; class A end; a = A.new; a.singleton_class.prepend M; a`
    );
    assert.is(obj2.className, Symbol.for("A"));
    assert.equal(obj2.extends, [Symbol.for("M"), Symbol.for("A")]);
  });

  test("circular", async () => {
    let arr: any[] = await loads(`a = []; a << a; a`);
    assert.is(arr[0], arr);

    let hash: marshal.RubyHash = await loads(`a = {}; a[:a] = a; a`);
    assert.is(hash.entries[0][1], hash);

    let obj: marshal.RubyObject = await loads(`a = Object.new; a.instance_variable_set :@a, a; a`);
    assert.is(obj.instanceVariables?.[0][1], obj);
  });
});
