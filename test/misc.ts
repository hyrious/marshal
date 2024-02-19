import * as assert from "uvu/assert";
import * as marshal from "../src";
import { describe } from "./helper";

describe("misc", test => {
  test("numeric.valueOf()", () => {
    let a = new marshal.RubyInteger(1);
    let b = new marshal.RubyFloat(0.2);
    assert.is((a as any) + b, 1 + 0.2);
  });
});
