import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { rubyMarshalLoad } from "../helper";

test("number", async () => {
  assert.is(await rubyMarshalLoad(marshal.dump(114514)), "114514");
  assert.is(await rubyMarshalLoad(marshal.dump(-1919810)), "-1919810");
  assert.is(await rubyMarshalLoad(marshal.dump(1145141919810)), "1145141919810");
  assert.is(await rubyMarshalLoad(marshal.dump(123.456)), "123.456");
});
