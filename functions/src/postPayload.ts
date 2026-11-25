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

import { evaluatePostModeration, type ModerationDecision } from "./moderation";

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 5000;
export const MAX_IMAGES = 8;
export const MAX_POLL_CHOICES = 6;
export const MAX_POLL_QUESTION = 200;

export const POST_TYPES = ["info", "notes", "event", "confession", "others"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_PRIVACIES = ["public", "private"] as const;
export type PostPrivacy = (typeof POST_PRIVACIES)[number];

/** The author identity, taken from the signed-in user, never from the submitted payload. */
export interface PostAuthor {
  uid: string;
  name?: string | null;
  username?: string | null;
  school?: string | null;
  city?: string | null;
  profilePicture?: string | null;
  anonymousPersonaName?: string | null;
}

export interface BuiltPost {
  /** The exact fields written to `posts/{id}` (timestamps are added by the caller). */
  document: Record<string, unknown>;
  decision: ModerationDecision;
}

/** Thrown for any payload the backend refuses. `message` is safe to show to the user. */
export class PostValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostValidationError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PostValidationError("The post payload is malformed.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new PostValidationError(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new PostValidationError(`${field} is too long.`);
  return trimmed;
}

function httpsUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new PostValidationError("Media URLs must be text.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PostValidationError("One of the media URLs is invalid.");
  }
  if (parsed.protocol !== "https:") {
    throw new PostValidationError("Media URLs must use https.");
  }
  return parsed.toString();
}

function urlList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new PostValidationError("imageUrls must be a list.");
  if (value.length > MAX_IMAGES) throw new PostValidationError(`Attach at most ${MAX_IMAGES} images.`);
  return value.map((entry) => httpsUrl(entry)).filter((entry): entry is string => entry !== null);
}

function imagesDetailed(value: unknown): Array<{ url: string; w: number | null; h: number | null }> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new PostValidationError("imagesDetailed must be a list.");
  return value.slice(0, MAX_IMAGES).map((entry) => {
    const data = record(entry);
    const url = httpsUrl(data.url);
    if (!url) throw new PostValidationError("One of the images is missing its URL.");
    return {
      url,
      w: typeof data.w === "number" && Number.isFinite(data.w) ? data.w : null,
      h: typeof data.h === "number" && Number.isFinite(data.h) ? data.h : null,
    };
  });
}

function poll(value: unknown, now: number): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  const data = record(value);
  const choices = Array.isArray(data.choices)
    ? data.choices
        .filter((choice): choice is string => typeof choice === "string")
        .map((choice) => choice.trim())
        .filter(Boolean)
    : [];
  if (choices.length < 2) return null;
  if (choices.length > MAX_POLL_CHOICES) throw new PostValidationError("Too many poll choices.");
  const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : Number(data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new PostValidationError("The poll end time has already passed.");
  }
  // Votes are always empty on creation: the client never controls the tally.
  return { choices: choices.slice(0, MAX_POLL_CHOICES), expiresAt: new Date(expiresAt), votes: {} };
}

/**
 * Validates a submitted post and returns the document the backend will store.
 *
 * Everything security-relevant is derived here, not trusted from the payload:
 * `authorId` = authenticated uid, `authorName`/school/city from the profile, `status` and the
 * moderation fields from `evaluatePostModeration`, `upvotesCount`/`repliesCount` reset to 0, and
 * poll votes always `{}`.
 */
export function buildPostDocument(input: unknown, author: PostAuthor, now: number = Date.now()): BuiltPost {
  const data = record(input);

  if (!author.uid) throw new PostValidationError("Sign in to publish a post.");

  const title = text(data.title, "Title", MAX_TITLE_LENGTH);
  const content = text(data.content, "Post", MAX_CONTENT_LENGTH);
  if (!title && !content && urlList(data.imageUrls).length === 0) {
    throw new PostValidationError("Add a title, message, or image before publishing.");
  }

  const type = text(data.type, "Type", 32) as PostType;
  if (!POST_TYPES.includes(type)) throw new PostValidationError("Choose a valid post type.");

  const privacy = (text(data.privacy, "Privacy", 16) || "public") as PostPrivacy;
  if (!POST_PRIVACIES.includes(privacy)) throw new PostValidationError("Choose a valid privacy setting.");

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
  if (!school) throw new PostValidationError("Add your school to your profile before posting.");

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
  const decision = evaluatePostModeration({ title, content, hasMedia });

  const authorName = wantsAnonymous
    ? persona || anonymousPersona || "Anonymous"
    : text(author.name, "Name", 120) || text(author.username, "Username", 40) || "Student";

  const document: Record<string, unknown> = {
    title,
    content,
    type,
    school,
    city: text(author.city, "City", 120) || text(data.city, "City", 120) || null,
    authorId: author.uid,
    authorName,
    // The photo is read from the profile document, not the payload: both clients stopped sending
    // it when creation moved to the callable, and the feed renders `authorProfilePicture` directly.
    authorProfilePicture: wantsAnonymous
      ? null
      : text(author.profilePicture, "Photo", 2048) || text(data.authorProfilePicture, "Photo", 2048) || null,
    status: decision.status,
    privacy,
    isAnonymous: wantsAnonymous,
    personaName: wantsAnonymous ? authorName : null,
    reactionsCount: type === "confession" ? {} : null,
    imageUrls,
    imageWidth: detailed[0]?.w ?? null,
    imageHeight: detailed[0]?.h ?? null,
    imagesDetailed: detailed,
    upvotesCount: 0,
    downvotesCount: 0,
    repliesCount: 0,
    ...(pdfUrl ? { pdfUrl, pdfPages } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(pollDoc ? { poll: pollDoc } : {}),
  };

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
export function promotionPatch(data: Record<string, unknown>): { status: string } | null {
  if (data.moderationFlagged === true) return null;
  if (data.status !== "pending") return null;
  const { decision } = buildPostDocumentFromExisting(data);
  if (decision.status !== "approved") return null;
  return { status: "approved" };
}

/**
 * Rebuilds the moderation inputs from a stored document (no validation: the document already
 * exists and may predate this code).
 */
function buildPostDocumentFromExisting(data: Record<string, unknown>): BuiltPost {
  const hasMedia = Array.isArray(data.imageUrls)
    ? data.imageUrls.length > 0
    : Boolean(data.imageUrl || data.pdfUrl || data.videoUrl);
  return {
    document: data,
    decision: evaluatePostModeration({
      title: typeof data.title === "string" ? data.title : "",
      content: typeof data.content === "string" ? data.content : "",
      hasMedia,
    }),
  };
}
