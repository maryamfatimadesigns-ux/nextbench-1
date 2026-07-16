# Chat Overhaul — Smoothness, Club Fixes & WhatsApp/Telegram Feature Parity

**Status:** Approved · **Date:** 2026-07-14

Full phased rebuild of the chat system (DMs + clubs). Root problem: `useChatEngine.ts`
rebuilds the entire message array on every Firestore snapshot (`snapshot.forEach()`
instead of `snapshot.docChanges()`), which changes every message's object identity on
every send/receive and defeats `React.memo`, causing the "reloads on every message"
complaint. Compounding issues: listener-recreating pagination, no virtualization
(previously tried once and abandoned badly), several club-specific bugs, and a large
missing feature set relative to WhatsApp/Telegram. Delivered as 6 ordered phases, each
landed as its own atomic commit(s), so the live product is never broken mid-flight.

## Locked decisions
| Area | Decision |
|------|----------|
| Scope | Full rewrite of the chat feature (not a patch), DMs + clubs both, "everything WhatsApp/Telegram has" |
| Rollout | Phased rebuild, atomic commits per logical change, no single giant PR |
| Select mode | Both conversation-list multi-select AND in-chat message multi-select (message-level already partially exists — extend it) |
| Read receipts / typing | Built for both DMs and clubs, including a per-message "seen by" list for group chats |
| Visual design | Not bound to existing `DESIGN.md` bubble/tick treatment — chat gets its own palette (below), kept as an addendum, `DESIGN.md` itself untouched |
| Data model precedent | New per-user list fields (`archivedBy`, `mutedBy`, `readBy`, `typingUsers`) follow the existing `unreadBy: uid[]` pattern already used on `chatRooms`/`clubs` docs |

## Visual addendum (chat-specific, not in DESIGN.md)
- Outgoing bubble: brand-pink (`#FF375F`) at low-opacity fill, white/ink text, asymmetric
  corner radius (tail corner sharp, others rounded) — iMessage/Telegram-style, not
  WhatsApp's uniform rounding.
- Incoming bubble: `--color-surface-elevated`, 1px `--color-border`, mirrored radius.
- Ticks: single check = sent, double check (ink-muted) = delivered, double check
  (brand-teal) = read.
- Typing indicator: three-dot pulse in brand-teal.
- Day dividers: small pill, `--color-surface-soft`, existing `label-caps` styling.
- Unread divider: brand-pink hairline + label when entering a room with unread messages.
- Selection mode: selected bubble gets brand-pink/8% wash + mint checkmark circle
  (reuses the verification-badge mint already used elsewhere for "confirmed" states).
- Motion stays on DESIGN.md's existing rules (ease-out-quart, no bounce) — cross-app
  consistency, not chat-specific.

## Phase 1 — Stop the bleeding (data layer + highest-severity club bugs)
- `useChatEngine.ts`: replace `snapshot.forEach()` full-rebuild with
  `snapshot.docChanges()` applied to a `Map<id, Message>` ref. Only added/modified docs
  get new object identity; removed docs are spliced; unaffected messages keep their exact
  reference across renders, which is what lets memoized bubbles skip re-render.
- Pagination: live listener stays fixed at newest ~50 messages, never torn down. "Load
  older" becomes a one-time `getDocs(query(..., startAfter(oldestLoadedDoc), limit(50)))`
  that prepends into the Map. Older, paged-in messages are not live-updated after load —
  accepted trade-off, matches WhatsApp/Telegram.
- Club sends stop doing a per-message `getDoc(clubs/roomId)`; `ClubChat.tsx` passes its
  already-live member list down instead.
- Memoize `onPin` and other callbacks passed from `ChatRoom.tsx` / `ClubChat.tsx` into
  `ChatView` with `useCallback`.
- Club Bug A (`onlyLeadsCanPost` not enforced): wire `canPost` into the actual send path
  (submit handler, send button, image/voice buttons, `MentionInput`) client-side, and add
  a matching check to the `clubs/{id}/messages` `create` rule in `firestore.rules`
  server-side.
- Club Bug B (`markAsRead` wrongly bumping `updatedAt` for clubs): delete the stale
  `updatedAt: serverTimestamp()` write for the `clubs` branch in `markAsRead` — the rule
  that required it was already relaxed in a prior commit, this write is now just a bug.
- Club Bug C (misleading empty state on public-club preview): gate message-loading on
  `club.memberIds.includes(uid)` client-side before opening the listener; on
  permission-denied, show "Join this club to view messages" instead of the generic
  "Start the conversation" empty state.
- Club Bug D (server-side): add the same `isValidMessage()` validation to the club
  message `create` rule that DM messages already get, for parity/hardening.
- `MessagesLayout.tsx`: fix club list-item preview to gate on `club.lastMessage` (with
  the same fallback chain DM items use) instead of `club.lastSenderName`, and reconcile
  the local `ClubData` type with the canonical one in `lib/clubs.ts`.
- **Milestone:** send/receive in a DM and a club, confirm no visible re-flicker of
  unrelated messages, confirm non-leads can't post in a leads-only club (both client
  attempt and a direct rules-emulator write), confirm reading a club doesn't reorder
  the inbox.

## Phase 2 — Extract components & re-virtualize
Split `ChatView.tsx` (1191 lines) into:
- `ChatHeader.tsx` — avatar, name, presence/typing label, back button, overflow menu.
- `MessageList.tsx` — virtualized scroll container, day dividers, unread divider,
  "load older" trigger, jump-to-bottom FAB, scroll anchoring.
- `MessageBubble.tsx` — single message render (text/image/voice/video, reactions, ticks,
  reply preview, swipe-to-reply), stays `React.memo`-wrapped.
- `MessageContextMenu.tsx` — long-press/right-click menu (reply, forward, copy, select,
  delete, pin, info).
- `Composer.tsx` — text input, attach, voice-record, send, reply-preview bar, typing
  emit.
- `SelectionToolbar.tsx` — shared bulk-action bar, reused by inbox multi-select (Phase 3)
  and message multi-select (Phase 4).

`ChatView.tsx` becomes a thin orchestrator. Only `ChatView` talks to `useChatEngine`;
other pieces take plain props/callbacks.

Virtualization: reintroduce `@tanstack/react-virtual`'s `useVirtualizer` with
`measureElement` wired to each bubble's ref (dynamic height correction after paint) —
the abandoned `ChatView-stashed.tsx` attempt used a bad fixed 64px estimate with no
measurement, causing scroll-jump; that's the bug being fixed here, not virtualization
itself. `overscan: 6-8`, seed `estimateSize` at ~80px. Preserve "stick to bottom on new
message" and add scroll-anchor preservation when prepending older messages.

Mobile perf: replace the sticky header's `backdrop-blur-md` with a solid
`--color-surface-elevated` background + 1px border (pure decoration, real GPU cost on
Android WebView, no functional loss).

**Milestone:** scroll a 500+ message thread on a throttled/low-end profile with no
dropped frames or scroll-jump; typing in the composer stays lag-free with virtualization
active.

## Phase 3 — Inbox-level polish (`MessagesLayout.tsx`)
- Replace `window.history.pushState`/`replaceState` with `navigate()`/router state.
- Long-press (mobile) / hover-checkbox (desktop) multi-select on conversation list items,
  using `SelectionToolbar` from Phase 2, with bulk actions: **Pin**, **Mark read/unread**,
  **Mute**, **Archive**, **Delete**. Pin and delete already exist per-conversation
  (`ChatRoom.tsx`); mute/archive are new.
- New per-user array fields on `chatRooms`/`clubs` docs, following the existing
  `unreadBy: uid[]` pattern: `mutedBy: uid[]`, `archivedBy: uid[]`. Archived rooms move to
  a separate "Archived" list view (still reachable, excluded from the main inbox and from
  unread badge counts); muted rooms stay in the inbox but skip push/badge notification.
- Themed confirm dialogs (reusing existing modal primitives elsewhere in the app) replace
  native `confirm()` for bulk delete.
- **Milestone:** select 3+ conversations, archive them, confirm they leave the main list
  and unread badge, and are recoverable from an Archived view.

## Phase 4 — Message-level feature parity
- **Link previews:** new Cloud Function (`functions/linkPreview.ts`, callable) fetches a
  URL server-side, extracts OpenGraph tags (title/description/image), caches the result
  in a `linkPreviews/{urlHash}` Firestore collection (hash of the normalized URL) to avoid
  re-fetching. `LinkifiedText.tsx` triggers a lookup on detected URLs and renders a
  preview card below the message text when data resolves; falls back to a plain link if
  the fetch fails or times out.
- **Video in chat:** new `type: 'video'` message. Upload path mirrors the existing image
  pipeline (Cloudinary); client captures a poster frame via canvas at ~1s (same technique
  already used for Stories video, see `storyMedia.ts`). Rendered in `MessageBubble` via
  the existing `VideoPlayer.tsx` (already used elsewhere, just not wired into chat).
- **Forward message:** long-press → Forward → modal listing the user's conversations
  (DMs + clubs) with multi-target selection. New `forwardMessage(messageIds, targetRoomIds)`
  in `useChatEngine` — creates a new message doc per target referencing original content
  plus `forwardedFrom: {senderId, senderName}` metadata, respecting each target's
  `canPost`/membership rules exactly like a normal send.
- **Bulk delete-for-everyone:** extend the existing bulk-delete UI (currently
  delete-for-me only, via native `confirm()`) to offer delete-for-everyone when the
  selection is all-own-messages and within any existing time window the single-message
  path already enforces; replace native `confirm()` with the themed dialog from Phase 3.
- **Milestone:** paste a URL and see a preview card render; send a video and play it
  inline; forward a message to 2 conversations at once; bulk-delete-for-everyone a
  multi-select of own messages.

## Phase 5 — Realtime social layer (typing + read receipts, DMs + clubs)
- **Typing indicators:** `typingUsers: { [uid]: Timestamp }` map field on the room/club
  doc, written on composer input with a ~2s debounce, cleared on blur/send. Client treats
  any entry older than ~5s as stale (no explicit clear-write needed on timeout). DM
  rendering: "typing…" under the header. Club rendering: "X is typing" / "X and Y are
  typing" / "Several people are typing" (WhatsApp-group convention).
- **Read receipts:** `readBy: uid[]` array on each message doc. Extends the existing
  throttled `markAsRead` (already 2s-throttled) to also `arrayUnion` the viewer's uid onto
  the currently-visible message range (derived from the Phase 2 virtualizer's visible
  range), batched into one write per throttle window rather than per-message, to avoid a
  write storm while scrolling.
  - DM ticks: sent (message exists) → delivered (recipient's client has synced it,
    inferred same as today) → read (`readBy` contains the other uid) — rendered per the
    visual addendum above.
  - Club "seen by": tap/long-press → info on an own message shows the resolved name list
    from `readBy`; a single checkmark on the bubble itself indicates "seen by at least
    one member," matching WhatsApp group behavior rather than trying to show every
    member's tick inline.
- **Firestore rules:** add a field-scoped update rule on `messages` allowing any room
  member (not just the sender) to update *only* the `readBy` field via `arrayUnion` of
  their own uid, using `request.resource.data.diff(resource.data).affectedKeys()` to
  restrict the writable field set. Same pattern for `typingUsers` on the parent room/club
  doc.
- **Milestone:** two accounts in the same DM/club — typing shows live on the other
  client within ~2s and clears within ~5s of stopping; sent message shows read state
  flip when the recipient views it; group "seen by" list resolves correct names.

## Phase 6 — Cleanup
- Delete `ChatView-stashed.tsx`, `resolve_chatview.py`, `resolve_conflicts.py`,
  `resolve_usechatengine.py`, `dummy.sh` (confirmed dead merge-resolution debris, not
  imported anywhere, no functionality worth preserving).
- Final pass: `tsc --noEmit`, `vite build`, manual smoke test on an Android
  (Capacitor) build for the mobile-lag complaint specifically.

## Testing & verification
- Firestore rules changes (Phase 1 club rules, Phase 5 field-scoped update rules)
  verified via the existing rules-emulator test setup.
- `tsc --noEmit` + `vite build` after every phase.
- Manual QA per phase's milestone (listed above) is the primary verification method —
  chat has no existing component test harness; adding one is out of scope for this spec.
- Phase 2's virtualization and Phase 1's re-render fix specifically verified with React
  DevTools profiler (confirm unrelated bubbles do not re-render on new message) in
  addition to visual scroll testing.

## Out of scope
- Voice/video calling.
- Message editing (edit-after-send) — not currently requested; existing delete pipeline
  untouched beyond the bulk-delete-for-everyone addition in Phase 4.
- End-to-end encryption.
- Disappearing messages / view-once media.
- Broadcast lists / channels (distinct from clubs).
- Desktop-specific keyboard shortcut overhaul beyond what already exists.

## Notes / risks
- Phase 5's per-message `readBy` writes are the highest write-volume addition in this
  spec; the batched/throttled approach mirrors the existing `markAsRead` pattern
  specifically to bound this, but should be watched under real usage (a busy club with
  many simultaneous readers is the worst case).
- Link previews (Phase 4) introduce the first outbound-fetching Cloud Function in the
  chat path — needs basic SSRF hardening (reject non-http(s) schemes, private/internal
  IP ranges) since it fetches arbitrary user-supplied URLs.
- Phase 2's "typing lag was actually the docChanges bug, not virtualization" is a
  hypothesis based on code reading, not yet empirically confirmed — validated as part of
  Phase 2's milestone; if virtualization still causes issues even with stable object
  identity, fall back to a windowed `.slice()` render (simpler, less smooth) rather than
  reverting to the current fully-unvirtualized `.map()`.
