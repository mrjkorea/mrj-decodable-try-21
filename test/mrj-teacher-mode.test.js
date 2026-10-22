"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("index.html wires server isTeacher bypass", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /function mrjTeacher\(\)/);
  assert.match(html, /isTeacher\(\)/);
  assert.match(html, /mrj-teacher/);
});
