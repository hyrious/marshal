import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe, rb_dump, rb_str } from "./helper";

function loads(code: string, options?: marshal.LoadOptions): Promise<any> {
  return rb_dump(code).then(e => marshal.load(e, options));
}

describe("load", test => {
  test("error on short data", async () => {
    try {
      await marshal.load(Uint8Array.of());
      assert.unreachable("should throw error");
    } catch (e) {
      assert.instance(e, TypeError);
      assert.match(e.message, /too short/);
    }
    try {
      await marshal.load(Uint8Array.of(0x4, 0x9, 0, 0));
      assert.unreachable("should throw error");
    } catch (e) {
      assert.instance(e, TypeError);
      assert.match(e.message, /can't be read/);
    }
  });

  test("trivial value", async () => {
    assert.is(await loads(`nil`), null);
    assert.is(await loads(`true`), true);
    assert.is(await loads(`false`), false);
    assert.is(await loads(`0`), 0);
    assert.equal(await loads(`[]`), []);
    assert.equal(await loads(`{}`), {});
  });

  test("number", async () => {
    assert.is(await loads(`114514`), 114514);
    assert.is(await loads(`-1919810`), -1919810);
    assert.is(await loads(`1145141919810`), 1145141919810);
    assert.is(await loads(`123.456`), 123.456); // please, don't compare float

    let zero = await loads(`-0.0`, { numeric: "wrap" });
    assert.instance(zero, marshal.RubyFloat);
    assert.is(zero.value, -0);
  });

  test("string", async () => {
    const repeat = (Math.random() * 100) | 0;
    assert.is(await loads(`'a' * ${repeat}`), "a".repeat(repeat));
    assert.is(await loads(`"a".force_encoding 'ascii'`), "a");
    const data = await loads(`"a".force_encoding 'binary'`);
    assert.instance(data, Uint8Array);
    assert.is(data[0], 97);
    const gbk = await loads(`"中文".encode 'gbk'`);
    assert.is(gbk, "中文");
    const binary_as_utf8 = await loads(`"a".force_encoding 'binary'`, { string: "utf8" });
    assert.is(binary_as_utf8, "a");
    const utf8_as_binary = await loads(`"a"`, { string: "binary" });
    assert.instance(utf8_as_binary, Uint8Array);
    assert.is(utf8_as_binary[0], 97);
  });

  test("symbol", async () => {
    assert.is(await loads(`:symbol`), Symbol.for("symbol"));
  });

  test("regexp", async () => {
    assert.equal(await loads(`/hello/`), /hello/);
  });

  test("hash", async () => {
    let hash = await loads(`a = Hash.new(false); a[:a] = true; a`);
    assert.is(hash[marshal.S_DEFAULT], false);
    assert.is(hash[Symbol.for("a")], true);
  });

  test("extended", async () => {
    let obj1: marshal.RubyObject = await loads(`module M end; class A end; a = A.new; a.extend M; a`);
    assert.is(obj1.class, Symbol.for("A"));
    assert.equal(obj1[marshal.S_EXTENDS], [Symbol.for("M")]);

    let obj2: marshal.RubyObject = await loads(
      `module M end; class A end; a = A.new; a.singleton_class.prepend M; a`,
    );
    assert.is(obj2.class, Symbol.for("A"));
    assert.equal(obj2[marshal.S_EXTENDS], [Symbol.for("M"), Symbol.for("A")]);
  });

  test("circular", async () => {
    let arr: unknown[] = await loads(`a = []; a << a; a`);
    assert.is(arr[0], arr);

    let hash = await loads(`a = {}; a[:a] = a; a`);
    assert.is(hash[Symbol.for("a")], hash);

    let obj: marshal.RubyObject = await loads(`a = Object.new; a.instance_variable_set :@a, a; a`);
    assert.is(obj[Symbol.for("@a")], obj);
  });

  test("struct", async () => {
    let struct = marshal.load(
      await rb_str`"\004\bS:\023Struct::Useful\a:\006ai\006:\006bi\a"`,
    ) as marshal.RubyStruct;
    assert.instance(struct, marshal.RubyStruct);
    assert.is(struct.class, Symbol.for("Struct::Useful"));
    assert.is(struct.members[Symbol.for("a")], 1);
    assert.is(struct.members[Symbol.for("b")], 2);
  });

  test("hashSymbolKeysToString", async () => {
    let hash = await loads(`{ a: 1, "b" => 2 }`, { hashSymbolKeysToString: true });
    assert.equal(hash, { a: 1, b: 2 });
  });

  test("hash: map | wrap", async () => {
    let map: Map<unknown, unknown> = await loads(`{ a: 1, "b" => 2 }`, { hash: "map" });
    assert.instance(map, Map);
    assert.equal(map.get(Symbol.for("a")), 1);
    assert.equal(map.get("b"), 2);

    let wrapper: marshal.RubyHash = await loads(`{ a: 1, "b" => 2 }`, { hash: "wrap" });
    assert.instance(wrapper, marshal.RubyHash);
    assert.equal(wrapper.entries, [
      [Symbol.for("a"), 1],
      ["b", 2],
    ]);
  });

  test("ivarToString", async () => {
    let obj = await loads(`a = Object.new; a.instance_variable_set :@a, 1; a`, { ivarToString: true });
    assert.is(obj["@a"], 1);

    obj = await loads(`a = Object.new; a.instance_variable_set :@a, 1; a`, { ivarToString: "_" });
    assert.is(obj["_a"], 1);

    obj = await loads(`a = Object.new; a.instance_variable_set :@a, 1; a`, { ivarToString: "" });
    assert.is(obj["a"], 1);

    obj = await loads(`a = Object.new; a.instance_variable_set :@a, 1; a`, { ivarToString: "@@" });
    assert.is(obj["@@a"], 1);
  });

  test("known", async () => {
    class A {}
    let obj = await loads(`class A end; A.new`, { known: { A } });
    assert.instance(obj, A);
  });
});
