import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { ruby } from "../helper";

test("example", async () => {
  assert.is(marshal.load(await ruby(`114514`)), 114514);
  assert.is(marshal.load(await ruby(`-1919810`)), -1919810);
  assert.is(marshal.load(await ruby(`1145141919810`)), 1145141919810);
  assert.is(marshal.load(await ruby(`123.456`)), 123.456); // don't compare float
});
