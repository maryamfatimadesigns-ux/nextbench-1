const test = require("node:test");
const assert = require("node:assert/strict");

const {
  accountDeletionPlan,
  isDestructiveRetainedDelete,
  RETAINED_COLLECTIONS,
  DELETED_USER_LABEL,
} = require("../lib/accountDeletion.js");

const plan = accountDeletionPlan();

test("the plan never bulk-deletes retained moderation or chat evidence", () => {
  for (const step of plan) {
    assert.equal(
      isDestructiveRetainedDelete(step),
      false,
      `${step.collection}.${step.field} would delete a retained collection`,
    );
  }
  assert.deepEqual([...RETAINED_COLLECTIONS].sort(), ["chatRooms", "reports", "reviews"]);
});

test("owned content is deleted by its author/seller/user link", () => {
  const deletes = plan.filter((step) => step.op === "delete").map((step) => `${step.collection}.${step.field}`);
  assert.ok(deletes.includes("posts.authorId"));
  assert.ok(deletes.includes("post_replies.authorId"));
  assert.ok(deletes.includes("products.sellerId"));
  assert.ok(deletes.includes("saved_posts.userId"));
  assert.ok(deletes.includes("blocks.blockerId"));
  assert.ok(deletes.includes("blocks.blockedId"));
  assert.ok(deletes.includes("notifications.userId"));
});

test("reviews are anonymised, not deleted", () => {
  const review = plan.find((step) => step.collection === "reviews");
  assert.ok(review);
  assert.equal(review.op, "anonymize");
  assert.equal(review.patch.reviewerName, DELETED_USER_LABEL);
});

test("reports are retained untouched (no identity fields to strip)", () => {
  assert.equal(plan.some((step) => step.collection === "reports"), false);
});

test("the profile document is not part of the query plan (deleted last, in code)", () => {
  assert.equal(plan.some((step) => step.collection === "users"), false);
});
