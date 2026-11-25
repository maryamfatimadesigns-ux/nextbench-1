const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { BANNED_KEYWORDS, isTextSafe, normalizeText } = require("../lib/moderation.js");

const browserSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "lib", "moderation.ts"),
  "utf8",
);

function browserKeywords() {
  const match = browserSource.match(/BANNED_KEYWORDS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(match, "BANNED_KEYWORDS not found in src/lib/moderation.ts");
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

test("server keyword list matches the browser list exactly", () => {
  assert.deepEqual([...BANNED_KEYWORDS], browserKeywords());
});

test("normalisation defeats spacing, leetspeak and punctuation", () => {
  assert.equal(normalizeText("S.E.X"), "sex");
  assert.equal(normalizeText("p0rn"), "porn");
  assert.equal(normalizeText("$hit"), "shit");
  assert.equal(isTextSafe("a totally normal post"), true);
  assert.equal(isTextSafe("moderatorbypass"), false);
  assert.equal(isTextSafe(""), true);
});
