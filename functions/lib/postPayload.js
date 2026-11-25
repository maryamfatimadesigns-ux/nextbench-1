"use strict";
/**
 * Server-owned post document construction.
 *
 * The post's `status` used to be chosen by whichever client created it, and `firestore.rules`
 * accepted `approved` from any verified user. That made the client the moderation authority: a
 * modified app (or a script) could publish unmoderated content, and there was a window where the
 * document was already `approved` (and listable in the feed) before `moderatePost` demoted it.
 *
 * Every post is now built here instead:
 *   - `submitPost` (authenticated callable) validates the payload, derives the author from the
 *     auth token + the users document, and stores the document with the Admin SDK.
 *   - `status` and the moderation fields are computed by `evaluatePostModeration`; a submitted
 *     `status` is ignored.
 *
 * This module is deliberately pure (no firebase-admin import) so the decisions can be unit tested
 * with `node --test`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostValidationError = exports.POST_PRIVACIES = exports.POST_TYPES = exports.MAX_POLL_QUESTION = exports.MAX_POLL_CHOICES = exports.MAX_IMAGES = exports.MAX_CONTENT_LENGTH = exports.MAX_TITLE_LENGTH = void 0;
exports.buildPostDocument = buildPostDocument;
exports.promotionPatch = promotionPatch;
const moderation_1 = require("./moderation");
exports.MAX_TITLE_LENGTH = 200;
exports.MAX_CONTENT_LENGTH = 5000;
exports.MAX_IMAGES = 8;
exports.MAX_POLL_CHOICES = 6;
exports.MAX_POLL_QUESTION = 200;
exports.POST_TYPES = ["info", "notes", "event", "confession", "others"];
exports.POST_PRIVACIES = ["public", "private"];
/** Thrown for any payload the backend refuses. `message` is safe to show to the user. */
class PostValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "PostValidationError";
    }
}
exports.PostValidationError = PostValidationError;
function record(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PostValidationError("The post payload is malformed.");
    }
    return value;
}
function text(value, field, max) {
    if (value === undefined || value === null)
        return "";
    if (typeof value !== "string")
        throw new PostValidationError(`${field} must be text.`);
    const trimmed = value.trim();
    if (trimmed.length > max)
        throw new PostValidationError(`${field} is too long.`);
    return trimmed;
}
function httpsUrl(value) {
    if (value === undefined || value === null || value === "")
        return null;
    if (typeof value !== "string")
        throw new PostValidationError("Media URLs must be text.");
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch (_a) {
        throw new PostValidationError("One of the media URLs is invalid.");
    }
    if (parsed.protocol !== "https:") {
        throw new PostValidationError("Media URLs must use https.");
    }
    return parsed.toString();
}
function urlList(value) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value))
        throw new PostValidationError("imageUrls must be a list.");
    if (value.length > exports.MAX_IMAGES)
        throw new PostValidationError(`Attach at most ${exports.MAX_IMAGES} images.`);
    return value.map((entry) => httpsUrl(entry)).filter((entry) => entry !== null);
}
function imagesDetailed(value) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value))
        throw new PostValidationError("imagesDetailed must be a list.");
    return value.slice(0, exports.MAX_IMAGES).map((entry) => {
        const data = record(entry);
        const url = httpsUrl(data.url);
        if (!url)
            throw new PostValidationError("One of the images is missing its URL.");
        return {
            url,
            w: typeof data.w === "number" && Number.isFinite(data.w) ? data.w : null,
            h: typeof data.h === "number" && Number.isFinite(data.h) ? data.h : null,
        };
    });
}
function poll(value, now) {
    if (value === undefined || value === null)
        return null;
    const data = record(value);
    const choices = Array.isArray(data.choices)
        ? data.choices
            .filter((choice) => typeof choice === "string")
            .map((choice) => choice.trim())
            .filter(Boolean)
        : [];
    if (choices.length < 2)
        return null;
    if (choices.length > exports.MAX_POLL_CHOICES)
        throw new PostValidationError("Too many poll choices.");
    const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : Number(data.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        throw new PostValidationError("The poll end time has already passed.");
    }
    // Votes are always empty on creation: the client never controls the tally.
    return { choices: choices.slice(0, exports.MAX_POLL_CHOICES), expiresAt: new Date(expiresAt), votes: {} };
}
/**
 * Validates a submitted post and returns the document the backend will store.
 *
 * Everything security-relevant is derived here, not trusted from the payload:
 * `authorId` = authenticated uid, `authorName`/school/city from the profile, `status` and the
 * moderation fields from `evaluatePostModeration`, `upvotesCount`/`repliesCount` reset to 0, and
 * poll votes always `{}`.
 */
function buildPostDocument(input, author, now = Date.now()) {
    var _a, _b, _c, _d;
    const data = record(input);
    if (!author.uid)
        throw new PostValidationError("Sign in to publish a post.");
    const title = text(data.title, "Title", exports.MAX_TITLE_LENGTH);
    const content = text(data.content, "Post", exports.MAX_CONTENT_LENGTH);
    if (!title && !content && urlList(data.imageUrls).length === 0) {
        throw new PostValidationError("Add a title, message, or image before publishing.");
    }
    const type = text(data.type, "Type", 32);
    if (!exports.POST_TYPES.includes(type))
        throw new PostValidationError("Choose a valid post type.");
    const privacy = (text(data.privacy, "Privacy", 16) || "public");
    if (!exports.POST_PRIVACIES.includes(privacy))
        throw new PostValidationError("Choose a valid privacy setting.");
    const wantsAnonymous = data.isAnonymous === true;
    if (wantsAnonymous && type !== "confession") {
        throw new PostValidationError("Only anonymous posts can be posted anonymously.");
    }
    const persona = text(data.personaName, "Persona name", 40);
    const anonymousPersona = text(author.anonymousPersonaName, "Persona name", 40);
    if (wantsAnonymous && !persona && !anonymousPersona) {
        throw new PostValidationError("Set an anonymous persona from your profile before posting anonymously.");
    }
    const school = text(author.school, "School", 200) || text(data.school, "School", 200);
    if (!school)
        throw new PostValidationError("Add your school to your profile before posting.");
    const imageUrls = urlList(data.imageUrls);
    const detailed = imagesDetailed(data.imagesDetailed);
    const pdfUrl = httpsUrl(data.pdfUrl);
    const videoUrl = httpsUrl(data.videoUrl);
    if (pdfUrl && imageUrls.length > 0) {
        throw new PostValidationError("Attach either images or a PDF, not both.");
    }
    const pdfPages = typeof data.pdfPages === "number" && Number.isFinite(data.pdfPages)
        ? Math.max(1, Math.trunc(data.pdfPages))
        : null;
    const pollDoc = poll(data.poll, now);
    const hasMedia = imageUrls.length > 0 || pdfUrl !== null || videoUrl !== null;
    const decision = (0, moderation_1.evaluatePostModeration)({ title, content, hasMedia });
    const authorName = wantsAnonymous
        ? persona || anonymousPersona || "Anonymous"
        : text(author.name, "Name", 120) || text(author.username, "Username", 40) || "Student";
    const document = Object.assign(Object.assign(Object.assign({ title,
        content,
        type,
        school, city: text(author.city, "City", 120) || text(data.city, "City", 120) || null, authorId: author.uid, authorName, 
        // The photo is read from the profile document, not the payload: both clients stopped sending
        // it when creation moved to the callable, and the feed renders `authorProfilePicture` directly.
        authorProfilePicture: wantsAnonymous
            ? null
            : text(author.profilePicture, "Photo", 2048) || text(data.authorProfilePicture, "Photo", 2048) || null, status: decision.status, privacy, isAnonymous: wantsAnonymous, personaName: wantsAnonymous ? authorName : null, reactionsCount: type === "confession" ? {} : null, imageUrls, imageWidth: (_b = (_a = detailed[0]) === null || _a === void 0 ? void 0 : _a.w) !== null && _b !== void 0 ? _b : null, imageHeight: (_d = (_c = detailed[0]) === null || _c === void 0 ? void 0 : _c.h) !== null && _d !== void 0 ? _d : null, imagesDetailed: detailed, upvotesCount: 0, downvotesCount: 0, repliesCount: 0 }, (pdfUrl ? { pdfUrl, pdfPages } : {})), (videoUrl ? { videoUrl } : {})), (pollDoc ? { poll: pollDoc } : {}));
    if (decision.flagged) {
        document.moderationFlagged = true;
        document.moderationReason = decision.reason;
    }
    return { document, decision };
}
/**
 * Should `moderatePost` promote this freshly created document?
 *
 * Used by the create trigger so a post that was written as `pending` by an older client (or any
 * direct write) converges to the same server decision instead of being stranded in the queue.
 * A post an admin deliberately holds is a *later* update, so the create-only trigger never touches
 * it, and a flagged post is never promoted.
 */
function promotionPatch(data) {
    if (data.moderationFlagged === true)
        return null;
    if (data.status !== "pending")
        return null;
    const { decision } = buildPostDocumentFromExisting(data);
    if (decision.status !== "approved")
        return null;
    return { status: "approved" };
}
/**
 * Rebuilds the moderation inputs from a stored document (no validation: the document already
 * exists and may predate this code).
 */
function buildPostDocumentFromExisting(data) {
    const hasMedia = Array.isArray(data.imageUrls)
        ? data.imageUrls.length > 0
        : Boolean(data.imageUrl || data.pdfUrl || data.videoUrl);
    return {
        document: data,
        decision: (0, moderation_1.evaluatePostModeration)({
            title: typeof data.title === "string" ? data.title : "",
            content: typeof data.content === "string" ? data.content : "",
            hasMedia,
        }),
    };
}
//# sourceMappingURL=postPayload.js.map