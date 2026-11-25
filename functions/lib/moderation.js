"use strict";
/**
 * Server-side content moderation (authoritative).
 *
 * This is a direct port of the browser helper in `src/lib/moderation.ts`. The browser copy still
 * exists because Feed.tsx uses it to give instant feedback before uploading, but that copy is now
 * *advisory only*: the status a post is stored with is decided here, by `submitPost` and the
 * `moderatePost` trigger, never by a client.
 *
 * Keep the keyword list and the normalisation in sync with `src/lib/moderation.ts` (there is a unit
 * test asserting the two lists are identical).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_APPROVE_MEDIA = exports.BANNED_KEYWORDS = void 0;
exports.normalizeText = normalizeText;
exports.isTextSafe = isTextSafe;
exports.evaluatePostModeration = evaluatePostModeration;
/** Homoglyph / leetspeak substitutions. Multi-character entries are not reachable by the
 *  per-character loop below, exactly as in the browser implementation; they are kept so both
 *  copies stay textually comparable. */
const homoglyphs = {
    "@": "a", "4": "a", "ª": "a", "æ": "ae",
    "3": "e", "€": "e", "£": "e",
    "1": "i", "!": "i", "|": "i", "¡": "i",
    "0": "o", "ø": "o", "œ": "oe",
    "5": "s", "$": "s", "§": "s",
    "7": "t", "+": "t",
    "2": "z", "8": "b",
    "vv": "w", "uu": "w",
    "ks": "x", "cs": "x",
    "9": "g", "6": "g",
};
/** Banned terms. Identical to `BANNED_KEYWORDS` in `src/lib/moderation.ts`. */
exports.BANNED_KEYWORDS = [
    "porn",
    "nsfw",
    "sex",
    "nude",
    "hentai",
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "cunt",
    "dick",
    "pussy",
    "bastard",
    "slut",
    "whore",
    "moderatorbypass",
];
/** Lowercase, substitute homoglyphs, keep only a-z (defeats "s.e.x" style spacing). */
function normalizeText(text) {
    let normalized = text.toLowerCase();
    normalized = normalized
        .split("")
        .map((char) => homoglyphs[char] || char)
        .join("");
    return normalized.replace(/[^a-z]/g, "");
}
/** True when the text contains no banned term once normalised. */
function isTextSafe(text) {
    if (!text)
        return true;
    const cleanText = normalizeText(text);
    return !exports.BANNED_KEYWORDS.some((word) => cleanText.includes(word));
}
/**
 * Whether a post that carries media may be auto-approved by the backend.
 *
 * `false` is the safe default: the backend has no way to inspect an image, so media posts are held
 * for a human in the admin panel. The browser used to auto-approve them because its image check is
 * a stub that always passes (`src/lib/imageModeration.ts`), which meant a modified client could
 * self-approve arbitrary media. Flip this only when a *server-side* image check exists (for example
 * Cloudinary's moderation add-on verified against the asset, or a Vision call); the callable and the
 * trigger both read this constant, so there is one place to change.
 */
exports.AUTO_APPROVE_MEDIA = false;
/**
 * The single moderation policy for a new post.
 *
 * - flagged text   -> pending (flagged, with the matched reason)
 * - media present  -> pending (human review) unless AUTO_APPROVE_MEDIA
 * - clean, text-only -> approved
 *
 * A client can never influence this: `status` is stripped from the submitted payload before this
 * runs, and `firestore.rules` no longer lets a client create an `approved` post at all.
 */
function evaluatePostModeration(input) {
    var _a, _b;
    const title = (_a = input.title) !== null && _a !== void 0 ? _a : "";
    const content = (_b = input.content) !== null && _b !== void 0 ? _b : "";
    if (!isTextSafe(title) || !isTextSafe(content)) {
        return { status: "pending", flagged: true, reason: "banned_keyword" };
    }
    if (input.hasMedia && !exports.AUTO_APPROVE_MEDIA) {
        return { status: "pending", flagged: false, reason: "media_review" };
    }
    return { status: "approved", flagged: false, reason: null };
}
//# sourceMappingURL=moderation.js.map