const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPostDocument,
  promotionPatch,
  PostValidationError,
  MAX_TITLE_LENGTH,
} = require("../lib/postPayload.js");

const author = {
  uid: "author-1",
  name: "Maya Singh",
  username: "maya",
  school: "Next School",
  city: "Lucknow",
};

const cleanText = { title: "Exam notes", content: "A concise guide", type: "notes", privacy: "public" };

test("clean text-only post is approved by the backend", () => {
  const { document, decision } = buildPostDocument(cleanText, author);
  assert.equal(decision.status, "approved");
  assert.equal(document.status, "approved");
  assert.equal(document.moderationFlagged, undefined);
});

test("a client-supplied status is ignored: media post is held for review", () => {
  const { document, decision } = buildPostDocument(
    {
      ...cleanText,
      status: "approved",
      imageUrls: ["https://res.cloudinary.com/demo/image/upload/a.jpg"],
    },
    author,
  );
  assert.equal(decision.status, "pending");
  assert.equal(decision.reason, "media_review");
  assert.equal(document.status, "pending");
  assert.equal(document.moderationFlagged, undefined);
});

test("a client cannot self-approve banned text", () => {
  const { document, decision } = buildPostDocument(
    { ...cleanText, title: "p0rn collection", status: "approved" },
    author,
  );
  assert.equal(decision.status, "pending");
  assert.equal(decision.flagged, true);
  assert.equal(document.status, "pending");
  assert.equal(document.moderationFlagged, true);
  assert.equal(document.moderationReason, "banned_keyword");
});

test("author identity is taken from the token profile, never from the payload", () => {
  const { document } = buildPostDocument(
    { ...cleanText, authorId: "someone-else", authorName: "Impersonator", school: "Other School" },
    author,
  );
  assert.equal(document.authorId, "author-1");
  assert.equal(document.authorName, "Maya Singh");
  assert.equal(document.school, "Next School");
});

test("counters and poll votes are server-owned", () => {
  const { document } = buildPostDocument(
    {
      ...cleanText,
      upvotesCount: 9999,
      repliesCount: 9999,
      poll: { choices: ["A", "B"], expiresAt: Date.now() + 60_000, votes: { "0": 500 } },
    },
    author,
  );
  assert.equal(document.upvotesCount, 0);
  assert.equal(document.repliesCount, 0);
  assert.deepEqual(document.poll.votes, {});
});

test("the author photo comes from the profile, not the payload", () => {
  const { document } = buildPostDocument(
    { ...cleanText, authorProfilePicture: "https://cdn/attacker.jpg" },
    { ...author, profilePicture: "https://cdn/real.jpg" },
  );
  assert.equal(document.authorProfilePicture, "https://cdn/real.jpg");
});

test("anonymous posts keep the persona and redact the photo", () => {
  const { document } = buildPostDocument(
    {
      title: "late night",
      content: "a thought",
      type: "confession",
      isAnonymous: true,
      authorProfilePicture: "https://cdn/avatar.jpg",
    },
    { ...author, profilePicture: "https://cdn/avatar.jpg", anonymousPersonaName: "Late Night Notes" },
  );
  assert.equal(document.isAnonymous, true);
  assert.equal(document.personaName, "Late Night Notes");
  assert.equal(document.authorName, "Late Night Notes");
  assert.equal(document.authorProfilePicture, null);
});

test("invalid payloads are rejected with a user-safe message", () => {
  assert.throws(() => buildPostDocument({ title: "", content: "", type: "notes" }, author), PostValidationError);
  assert.throws(
    () => buildPostDocument({ ...cleanText, imageUrls: ["http://insecure/a.jpg"] }, author),
    PostValidationError,
  );
  assert.throws(
    () => buildPostDocument({ ...cleanText, title: "x".repeat(MAX_TITLE_LENGTH + 1) }, author),
    PostValidationError,
  );
  assert.throws(
    () => buildPostDocument({ ...cleanText, isAnonymous: true }, author),
    PostValidationError,
  );
  assert.throws(() => buildPostDocument({ ...cleanText }, { uid: "u", school: "" }), PostValidationError);
});

test("promotion converges a clean pending post and never touches media or flagged posts", () => {
  assert.deepEqual(promotionPatch({ status: "pending", title: "hello", content: "world" }), {
    status: "approved",
  });
  assert.equal(promotionPatch({ status: "pending", title: "hello", imageUrls: ["https://a/b.jpg"] }), null);
  assert.equal(promotionPatch({ status: "pending", title: "hello", moderationFlagged: true }), null);
  assert.equal(promotionPatch({ status: "approved", title: "hello" }), null);
  assert.equal(promotionPatch({ status: "pending", title: "porn" }), null);
});
