import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { rubyMarshalDump } from "../helper";

test("number", async () => {
  assert.is(marshal.load(await rubyMarshalDump(`114514`)), 114514);
  assert.is(marshal.load(await rubyMarshalDump(`-1919810`)), -1919810);
  assert.is(marshal.load(await rubyMarshalDump(`1145141919810`)), 1145141919810);
  assert.is(marshal.load(await rubyMarshalDump(`123.456`)), 123.456); // don't compare float
});
