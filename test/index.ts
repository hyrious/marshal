import { test } from "uvu";
import * as assert from "uvu/assert";

test("example", () => {
  const example = (_: "hello") => "world";

  assert.is(example("hello"), "world");
  assert.is(Math.sqrt(2), Math.SQRT2);
});

import "./parse/trivial";
import "./parse/number";
import "./parse/circular";

test.run();
