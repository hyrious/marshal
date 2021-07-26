import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { rubyMarshalLoad } from "../helper";

test("trivial value", async () => {
  assert.is(await rubyMarshalLoad(marshal.dump(null)), "nil");
  assert.is(await rubyMarshalLoad(marshal.dump(true)), "true");
  assert.is(await rubyMarshalLoad(marshal.dump(false)), "false");
  assert.is(await rubyMarshalLoad(marshal.dump(0)), "0");
  assert.is(await rubyMarshalLoad(marshal.dump([])), "[]");
  assert.is(await rubyMarshalLoad(marshal.dump(new marshal.RubyHash([]))), "{}");
});
