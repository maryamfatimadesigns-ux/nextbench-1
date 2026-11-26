"use strict";
/**
 * Account deletion: the plan, kept pure so it can be unit tested.
 *
 * `requestAccountDeletion` in `index.ts` executes this plan with the Admin SDK. The ordering and the
 * delete-vs-anonymise split are the security-sensitive part:
 *
 *   - **delete**: records that exist only because of this user.
 *   - **anonymize**: records that belong to someone else's history or to moderation/safety evidence.
 *     They must survive; only the deleted user's display identity is removed.
 *
 * The profile document is deleted last so a partial failure stays visible and retryable while the
 * user still exists.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETAINED_COLLECTIONS = exports.DELETED_USER_LABEL = void 0;
exports.accountDeletionPlan = accountDeletionPlan;
exports.isDestructiveRetainedDelete = isDestructiveRetainedDelete;
exports.DELETED_USER_LABEL = "Deleted user";
/**
 * Collections deleted outright, keyed by the field that links them to the user. Every entry is a
 * record that exists only for this user (their own content, their own bookmarks/votes/social edges).
 */
const OWNED_QUERIES = [
    ["posts", "authorId"],
    ["post_replies", "authorId"],
    ["products", "sellerId"],
    ["stories", "authorId"],
    ["saved_posts", "userId"],
    ["wishlists", "userId"],
    ["post_upvotes", "userId"],
    ["post_downvotes", "userId"],
    ["reply_upvotes", "userId"],
    ["post_reactions", "userId"],
    ["notifications", "userId"],
    ["follows", "followerId"],
    ["follows", "followingId"],
    ["blocks", "blockerId"],
    ["blocks", "blockedId"],
    ["follow_edges", "followerId"],
    ["follow_edges", "followingId"],
    ["usernames", "userId"],
    ["androidPushTokens", "userId"],
];
/**
 * Records that are retained. They are never in the delete set: a report, a review or a chat message
 * is the counterpart's or the platform's safety evidence, and erasing it would let a user delete
 * their way out of a moderation record.
 *
 * `reports` has no identity fields beyond `reporterId`/`contentId` (see `src/lib/reports.ts`), so a
 * report needs no anonymisation patch to remain meaningful; `reviews` carries a display name, which
 * is cleared here.
 */
const RETAINED_QUERIES = [
    { collection: "reviews", field: "reviewerId", patch: { reviewerName: exports.DELETED_USER_LABEL } },
];
/** The ordered plan: own content is deleted, retained evidence is anonymised in place. */
function accountDeletionPlan() {
    return [
        ...OWNED_QUERIES.map(([collection, field]) => ({ collection, field, op: "delete" })),
        ...RETAINED_QUERIES.map(({ collection, field, patch }) => ({
            collection,
            field,
            op: "anonymize",
            patch,
        })),
    ];
}
/** Collections that must never be bulk-deleted by the cascade (asserted by tests and at runtime). */
exports.RETAINED_COLLECTIONS = ["reports", "reviews", "chatRooms"];
/**
 * Guard against a plan edit that would destroy moderation evidence: no delete step may target a
 * retained collection. `reports` is retained in full — it has no identity fields to strip.
 */
function isDestructiveRetainedDelete(step) {
    return step.op === "delete" && exports.RETAINED_COLLECTIONS.includes(step.collection);
}
//# sourceMappingURL=accountDeletion.js.map