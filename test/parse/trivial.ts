import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { ruby } from "../helper";

test("trivial ruby values", async () => {
  assert.is(marshal.load(await ruby(`nil`)), null);
  assert.is(marshal.load(await ruby(`true`)), true);
  assert.is(marshal.load(await ruby(`false`)), false);
  assert.is(marshal.load(await ruby(`0`)), 0);
  assert.equal(marshal.load(await ruby(`[]`)), []);
  assert.instance(marshal.load(await ruby(`{}`)), marshal.RubyHash);
});
