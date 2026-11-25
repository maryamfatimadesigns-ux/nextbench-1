const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Static guard for the rule that actually enforces server-owned moderation.
 *
 * A full emulator run (`@firebase/rules-unit-testing`) is the stronger check but needs a Firestore
 * emulator; this test fails loudly if somebody re-opens client approval in the rules, which is the
 * regression that matters.
 */
const rules = fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8");

function postsCreateBlock() {
  const start = rules.indexOf("match /posts/{postId}");
  assert.ok(start > 0, "posts block not found");
  const end = rules.indexOf("allow update:", start);
  const block = rules.slice(start, end);
  const createAt = block.indexOf("allow create:");
  assert.ok(createAt > 0, "posts create rule not found");
  return block.slice(createAt);
}

test("a client may only create a pending post", () => {
  const create = postsCreateBlock();
  assert.match(create, /incoming\(\)\.status == 'pending'/);
  assert.doesNotMatch(create, /incoming\(\)\.status == 'approved'/);
});

test("clients cannot write server-owned moderation fields", () => {
  const create = postsCreateBlock();
  assert.match(create, /moderationFlagged/);
  assert.match(create, /moderationReason/);
});

test("account deletion state is server-only", () => {
  const start = rules.indexOf("match /deletionRequests/{userId}");
  assert.ok(start > 0);
  const nextMatch = rules.indexOf("match /", start + 10);
  const block = rules.slice(start, nextMatch === -1 ? undefined : nextMatch);
  assert.match(block, /create, update, delete: if false/);
});
