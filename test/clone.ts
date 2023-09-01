import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe } from "./helper";
import isPlainObject from "is-plain-obj";

const clone = (value: any, opts?: marshal.LoadOptions) => marshal.load(marshal.dump(value), opts);

describe("clone", test => {
  test("trivial value", () => {
    assert.is(clone(null), null);
    assert.is(clone(true), true);
    assert.is(clone(false), false);
    assert.is(clone(0), 0);
    assert.equal(clone([]), []);
    assert.is(isPlainObject(clone({})), true);
  });

  test("number", () => {
    assert.is(clone(114514), 114514);
    assert.is(clone(-1919810), -1919810);
    assert.is(clone(1145141919810), 1145141919810);
    assert.is(clone(123.456), 123.456);
  });

  test("string", () => {
    const repeat = (Math.random() * 100) | 0;
    const str = "a".repeat(repeat);
    assert.is(clone(str, { decodeString: true }), str);
  });

  test("array", () => {
    const arr = [null, true, false, 0, [], {}];
    assert.equal(clone(arr), arr);
  });

  test("regexp", () => {
    assert.equal(clone(/abc.def/im, { decodeRegexp: true }), /abc.def/im);
  });

  test("object", () => {
    const obj = { a: null, b: 42, c: [{}], d: { e: "hello" } };
    assert.equal(clone(obj, { decodeString: true }), obj);
  });

  test("circular", () => {
    let dup: any;

    let arr: any[] = [];
    arr.push(arr);
    dup = clone(arr);
    assert.is(dup, dup[0]);

    let hash: Record<string, any> = {};
    hash.a = hash;
    dup = clone(hash);
    assert.is(dup, dup.a);
  });
});
