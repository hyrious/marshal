import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe } from "./helper";

describe("clone", test => {
  test("trivial value", () => {
    assert.is(marshal.clone(null), null);
    assert.is(marshal.clone(true), true);
    assert.is(marshal.clone(false), false);
    assert.is(marshal.clone(0), 0);
    assert.equal(marshal.clone([]), []);
    assert.instance(marshal.clone({}), marshal.RubyHash);
  });

  test("number", () => {
    assert.is(marshal.clone(114514), 114514);
    assert.is(marshal.clone(-1919810), -1919810);
    assert.is(marshal.clone(1145141919810), 1145141919810);
    assert.is(marshal.clone(123.456), 123.456);
  });

  test("string", () => {
    const repeat = (Math.random() * 100) | 0;
    const str = "a".repeat(repeat);
    assert.is(marshal.clone(str), str);
  });

  test("array", () => {
    const arr = [null, true, false, 0, [], {}];
    assert.equal(marshal.clone(arr, { hashToJS: true }), arr);
  });

  test("regexp", () => {
    assert.equal(marshal.clone(/abc.def/im), /abc.def/im);
  });

  test("object", () => {
    const obj = { a: null, b: 42, c: [{}], d: { e: "hello" } };
    assert.equal(marshal.clone(obj, { hashToJS: true }), obj);
  });

  test("circular", () => {
    let dup: any;

    let arr: any[] = [];
    arr.push(arr);
    dup = marshal.clone(arr);
    assert.is(dup, dup[0]);

    let hash: Record<string, any> = {};
    hash.a = hash;
    dup = marshal.clone(hash, { hashToJS: true });
    assert.is(dup, dup.a);
  });
});
