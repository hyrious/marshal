import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { rubyMarshalDump } from "../helper";

test("trivial value", async () => {
  assert.is(marshal.load(await rubyMarshalDump(`nil`)), null);
  assert.is(marshal.load(await rubyMarshalDump(`true`)), true);
  assert.is(marshal.load(await rubyMarshalDump(`false`)), false);
  assert.is(marshal.load(await rubyMarshalDump(`0`)), 0);
  assert.equal(marshal.load(await rubyMarshalDump(`[]`)), []);
  assert.instance(marshal.load(await rubyMarshalDump(`{}`)), marshal.RubyHash);
});
