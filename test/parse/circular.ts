import { test } from "uvu";
import * as assert from "uvu/assert";
import * as marshal from "../../src";
import { ruby } from "../helper";

test("circular array", async () => {
  let a: any[] = marshal.load(await ruby(`a = []; a << a; a`));

  assert.is(a[0], a);
});

test("circular hash", async () => {
  let a: marshal.RubyHash = marshal.load(await ruby(`a = {}; a[:a] = a; a`));

  assert.is(a.pairs[0][1], a);
});

test("circular object", async () => {
  let a: marshal.RubyObject = marshal.load(
    await ruby(`a = Object.new; a.instance_variable_set :@a, a; a`)
  );

  assert.is(a.instanceVariables[0][1], a);
});
