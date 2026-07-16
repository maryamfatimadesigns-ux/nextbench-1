/**
 * Per-user conversation state — mute / archive / pin / read / delete
 *
 * Uniform helpers for the two conversation collections (`chatRooms` DMs and
 * `clubs` group chats). Every per-user toggle is stored as an array-of-uids
 * field on the room document, following the existing `unreadBy: uid[]`
 * precedent, so a member's own inbox state never affects anyone else's view.
 *
 * Fields (all `uid[]`, absent = empty):
 *   - mutedBy     — excluded from unread badge / push, still shown in inbox
 *   - archivedBy  — moved to the Archived view, out of the main inbox + badge
 *   - pinnedBy    — sorted to the top of the inbox (conversation-level pin,
 *                   distinct from the message-level `pinnedMessageId`)
 *   - deletedBy   — hidden for this user (soft); reappears on new activity
 *
 * IMPORTANT: none of these writes touch `updatedAt`. Bumping `updatedAt`
 * reorders every member's inbox (the Phase 1 markAsRead bug) — per-user
 * toggles must be invisible to conversation ordering.
 */

import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';

export type ConvCollection = 'chatRooms' | 'clubs';

const roomRef = (c: ConvCollection, roomId: string) => doc(db, c, roomId);

export function muteConversation(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { mutedBy: arrayUnion(uid) });
}

export function unmuteConversation(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { mutedBy: arrayRemove(uid) });
}

export function archiveConversation(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { archivedBy: arrayUnion(uid) });
}

export function unarchiveConversation(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { archivedBy: arrayRemove(uid) });
}

export function pinConversation(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { pinnedBy: arrayUnion(uid) });
}

export function unpinConversation(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { pinnedBy: arrayRemove(uid) });
}

/**
 * Mark read. Also clears the user's `deletedBy` entry: opening or explicitly
 * reading a conversation un-deletes it (a hidden room the user chose to read
 * should return to the inbox).
 */
export function markConversationRead(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), {
    unreadBy: arrayRemove(uid),
    deletedBy: arrayRemove(uid),
  });
}

export function markConversationUnread(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), { unreadBy: arrayUnion(uid) });
}

/**
 * Soft-delete (hide) a conversation for this user. Message documents are NOT
 * removed — this is an inbox-level hide. The room reappears if it later has the
 * user in `unreadBy` (new activity overrides the delete; see MessagesLayout
 * filtering). Clearing `unreadBy` here prevents a just-deleted room from
 * immediately re-surfacing via that override.
 */
export function deleteConversationForUser(c: ConvCollection, roomId: string, uid: string): Promise<void> {
  return updateDoc(roomRef(c, roomId), {
    deletedBy: arrayUnion(uid),
    unreadBy: arrayRemove(uid),
  });
}

/**
 * Run a per-user op across many conversations concurrently. Uses allSettled so
 * one permission/network failure doesn't abort the rest; the caller inspects
 * the results to surface partial failures.
 */
export function bulkConversationOp(
  items: { collection: ConvCollection; roomId: string }[],
  op: (c: ConvCollection, roomId: string, uid: string) => Promise<void>,
  uid: string
): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(items.map((it) => op(it.collection, it.roomId, uid)));
}
