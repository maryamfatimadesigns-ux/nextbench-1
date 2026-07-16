# Chat Phase 3 — Inbox-Level Polish (`MessagesLayout.tsx`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the messages inbox (`src/pages/Dashboard/MessagesLayout.tsx`) into a polished, WhatsApp/Telegram-grade conversation list: router-based navigation (no `history.pushState` hacks), multi-select with bulk actions (**Pin**, **Mark read/unread**, **Mute**, **Archive**, **Delete**), an **Archived** sub-view, muted-conversation handling, and themed confirm dialogs — all built on per-user array fields that follow the existing `unreadBy: uid[]` precedent, for both DMs (`chatRooms`) and clubs (`clubs`).

**Architecture:** A new `src/lib/conversations.ts` module owns every per-user conversation mutation (mute/archive/pin/read/unread/delete) uniformly across both collections, so the UI never writes Firestore directly. `MessagesLayout.tsx` gains selection state + an inbox action bar and an Archived toggle, and derives its list from the existing live listeners plus the new fields. `useUnreadChatCount.ts` learns to ignore muted + archived rooms. Firestore rules gain member-scoped per-user-field update permissions on `clubs` (chatRooms already permits most of these keys) plus `archivedBy` on `chatRooms`, verified by an extended emulator test suite.

**Tech Stack:** React 19, TypeScript, Vite, `motion/react`, Tailwind, lucide-react, Firebase Firestore, `@firebase/rules-unit-testing` (emulator tests).

## Global Constraints

- Every task lands as its own atomic commit (standing user instruction) — do not batch tasks.
- Work in place on `main` (user's established mode for this overhaul), `tsc --noEmit` + `vite build` green after every task.
- **Do NOT touch** `useChatEngine.ts`, `ChatView.tsx`, or any Phase 2 chat component — Phase 3 is inbox-scoped. The one exception is `useUnreadChatCount.ts` (Task 4), which is inbox infrastructure, not the chat engine.
- New per-user fields follow the `unreadBy: uid[]` array-of-uids precedent exactly (spec "Data model precedent"). No `updatedAt` bump on per-user toggles — bumping `updatedAt` reorders the inbox (the exact Phase 1 Task 6 bug); per-user state must be invisible to other members' ordering.
- Reuse existing primitives: `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`) for destructive confirms, `SelectionToolbar` (`src/components/chat/SelectionToolbar.tsx`) as the base for the bulk bar.
- Rules changes are verified with the existing emulator harness (`npm --prefix tests test`), then **deployed** via `firebase deploy --only firestore:rules` (user decision for Phase 3 — differs from Phases 1–2 which deferred deploy). Deploy happens in Task 2 Step 5 after the emulator suite is green.

## Reference: current state (read once before starting)

- **`MessagesLayout.tsx`** (674 lines): single listener on `chatRooms` (`participants array-contains uid`) + `useUserClubs` hook for clubs; merges into `combinedList` sorted by `updatedAt desc`. `openChat` (line 240) uses `window.history.pushState` on desktop and `navigate()` on mobile; `handleChatBack` (line 254) uses `pushState`. List items are two `<button>` branches (club @ 372-425, DM @ 430-480).
- **Rules** (`firestore.rules`):
  - `chatRooms` update (line 363) already allows member writes to `hasOnly([... 'unreadBy', ... 'mutedBy', 'pinnedBy', 'deletedBy', ...])` — but **not** `archivedBy`.
  - `clubs` update (line 435-459): member branch (line 443-444) only allows `hasOnly(['lastMessage','lastSenderId','lastSenderName','pinnedMessageId','pinnedMessageText','updatedAt','unreadBy'])` — no per-user mute/archive/pin/delete.
- **`useUnreadChatCount.ts`**: counts rooms/clubs where `unreadBy.includes(uid)`. No muted/archived awareness.
- **Existing fields:** `chatRooms` docs have `unreadBy`; `clubs` docs have `unreadBy`. Neither has `mutedBy`/`archivedBy`/`pinnedBy`/`deletedBy` populated yet (greenfield arrays — absent = empty).
- **`ClubData`** (`src/lib/clubs.ts:28`) and **`ChatRoomItem`** (`MessagesLayout.tsx:25`) types need the four new optional `uid[]` fields.

## Locked decisions (this plan)

| Question | Decision |
|----------|----------|
| Per-user fields | `mutedBy`, `archivedBy`, `pinnedBy`, `deletedBy` — all `uid[]`, absent = empty. |
| Pin semantics | Conversation-level pin (sorts pinned rooms to top of inbox), distinct from message-pin (`pinnedMessageId`). Uses `pinnedBy`. |
| Archive | Archived rooms leave the main inbox + unread badge, live in a separate Archived view, still openable. Uses `archivedBy`. A new message does NOT auto-unarchive (matches Telegram; WhatsApp auto-unarchives — we pick the simpler, less-surprising Telegram behavior). |
| Mute | Muted rooms stay in the inbox but are excluded from the unread badge count and (Phase 5+) push. Uses `mutedBy`. Visual: muted rooms show a small mute glyph, no unread emphasis. |
| Delete | Per-user soft hide via `deletedBy`. A room hidden by delete **reappears if it later has me in `unreadBy`** (new activity overrides the delete); opening a room clears my `deletedBy` entry. No message documents are deleted (that stays the per-message delete pipeline). |
| Read/unread | Mark-read = `arrayRemove(uid)` from `unreadBy`; mark-unread = `arrayUnion(uid)`. No `updatedAt` change. |
| updatedAt on toggles | Never bumped by per-user toggles (avoids inbox reorder). Rules already tolerate unchanged `updatedAt` on clubs; chatRooms has no updatedAt-time constraint. |
| Bulk-action bar | Extend `SelectionToolbar` to render a configurable action set while preserving its existing chat delete+cancel API (backward-compatible). |

---

### Task 1: Data-layer module `conversations.ts` (uniform per-user mutations)

**Files:**
- Create: `src/lib/conversations.ts`
- Modify: `src/lib/clubs.ts` (add 4 optional fields to `ClubData`), `src/pages/Dashboard/MessagesLayout.tsx` (add 4 optional fields to `ChatRoomItem`)

**Interfaces:**
- `type ConvCollection = 'chatRooms' | 'clubs';`
- Each helper takes `(collectionPath: ConvCollection, roomId: string, uid: string)` and performs a single `updateDoc` using `arrayUnion`/`arrayRemove` on one field, **without** writing `updatedAt`.

```ts
export type ConvCollection = 'chatRooms' | 'clubs';
export function muteConversation(c: ConvCollection, roomId: string, uid: string): Promise<void>;
export function unmuteConversation(c: ConvCollection, roomId: string, uid: string): Promise<void>;
export function archiveConversation(c: ConvCollection, roomId: string, uid: string): Promise<void>;
export function unarchiveConversation(c: ConvCollection, roomId: string, uid: string): Promise<void>;
export function pinConversation(c: ConvCollection, roomId: string, uid: string): Promise<void>;
export function unpinConversation(c: ConvCollection, roomId: string, uid: string): Promise<void>;
export function markConversationRead(c: ConvCollection, roomId: string, uid: string): Promise<void>;   // arrayRemove unreadBy + arrayRemove deletedBy (opening/marking-read un-deletes)
export function markConversationUnread(c: ConvCollection, roomId: string, uid: string): Promise<void>;  // arrayUnion unreadBy
export function deleteConversationForUser(c: ConvCollection, roomId: string, uid: string): Promise<void>; // arrayUnion deletedBy + arrayRemove unreadBy
// Bulk convenience: run a per-user op across many rooms, each tagged with its collection.
export function bulkConversationOp(items: { collection: ConvCollection; roomId: string }[], op: (c: ConvCollection, roomId: string, uid: string) => Promise<void>, uid: string): Promise<PromiseSettledResult<void>[]>;
```

- [ ] **Step 1: Write `conversations.ts`**

Implement each single-field helper with `updateDoc(doc(db, c, roomId), { <field>: arrayUnion|arrayRemove(uid) })`. `markConversationRead` clears both `unreadBy` and `deletedBy` (opening un-deletes, per locked decision). `deleteConversationForUser` sets `deletedBy` and clears `unreadBy` (a deleted room shouldn't count as unread). `bulkConversationOp` uses `Promise.allSettled` so one failure doesn't abort the batch, and returns the settle results for the caller to toast partial failures.

- [ ] **Step 2: Extend the two row types**

In `src/lib/clubs.ts`, add to `ClubData`: `mutedBy?: string[]; archivedBy?: string[]; pinnedBy?: string[]; deletedBy?: string[];`. In `MessagesLayout.tsx`, add the same four optional fields to `ChatRoomItem`.

- [ ] **Step 3: Verify** — `npm run lint` → 0. (No UI wired yet; this is pure lib + types.)

- [ ] **Step 4: Commit**
```bash
git add src/lib/conversations.ts src/lib/clubs.ts src/pages/Dashboard/MessagesLayout.tsx
git commit -m "feat(chat): add per-user conversation-state data layer (mute/archive/pin/delete)"
```

---

### Task 2: Firestore rules — allow member per-user field writes + rules tests

**Files:**
- Modify: `firestore.rules`
- Create: `tests/conversationState.rules.test.mjs`
- Modify: `tests/package.json` (add the new test file to the `test` script)

- [ ] **Step 1: `chatRooms` — add `archivedBy`**

In the `chatRooms` update rule (line 363), add `'archivedBy'` to the `hasOnly([...])` key list. (`mutedBy`, `pinnedBy`, `deletedBy`, `unreadBy` are already present.)

- [ ] **Step 2: `clubs` — add a member per-user-state branch**

In the `clubs` update rule (after the existing member preview branch at line 443-444), add a new OR branch:
```
||
// Member: toggle own per-user conversation state (mute/archive/pin/unread/delete).
// Only these array fields, and updatedAt must be unchanged (no inbox reorder).
(request.auth.uid in existing().memberIds
  && incoming().diff(existing()).affectedKeys().hasOnly(['mutedBy', 'archivedBy', 'pinnedBy', 'unreadBy', 'deletedBy'])
  && incoming().updatedAt == existing().updatedAt)
```
Note the top-level guard `incoming().updatedAt == request.time || incoming().updatedAt == existing().updatedAt` (line 436) already tolerates unchanged `updatedAt`; this branch additionally forbids bumping it. (We deliberately do NOT validate the array delta element-by-element — matching the existing lenient `unreadBy` handling; a member can only ever scope writes to these five list fields, and cross-member tampering of these lists is low-severity and symmetric with the current `unreadBy` model.)

- [ ] **Step 3: Rules tests**

Create `tests/conversationState.rules.test.mjs` mirroring `clubMessages.rules.test.mjs`'s harness (reuse the `clubData()` seed shape; add a `chatRoomData()` seed). Cover:
- ✅ member can `arrayUnion` self into `clubs/{id}.mutedBy` with unchanged `updatedAt`.
- ✅ member can `arrayUnion` self into `archivedBy`, `pinnedBy`, `deletedBy`, and toggle `unreadBy`.
- ❌ member write to those fields **with** a bumped `updatedAt` fails (guards the reorder bug).
- ❌ member write that also touches a non-per-user field (e.g. `name`) in the same diff fails.
- ✅ chatRooms participant can `arrayUnion` self into `archivedBy`.
- ❌ non-member cannot write `mutedBy` on a club.

Add `conversationState.rules.test.mjs` to the `test` script's node --test file list in `tests/package.json`.

- [ ] **Step 4: Verify** — `npm --prefix tests test` → all suites pass (existing 25 + new). `npm run lint` → 0.

- [ ] **Step 5: Deploy the rules** — after the emulator suite is green, run `firebase deploy --only firestore:rules` (user decision for Phase 3). If CLI auth is missing, escalate to the user to run `! firebase deploy --only firestore:rules` themselves; do not skip silently.

- [ ] **Step 6: Commit**
```bash
git add firestore.rules tests/conversationState.rules.test.mjs tests/package.json
git commit -m "feat(chat): allow member per-user conversation-state writes in rules + tests"
```

---

### Task 3: Router-based navigation (drop `history.pushState`)

**Files:** Modify `src/pages/Dashboard/MessagesLayout.tsx`

The desktop panel uses `window.history.pushState` to change the URL without unmounting the layout. Replace with React Router while preserving desktop-panel behavior (no full remount, back button works).

- [ ] **Step 1: Use `navigate()` with the existing routes**

The routes `/messages/:roomId` and `/messages/club/:clubId` already render `MessagesLayout` (App.tsx:227-228). Change `openChat` (line 240-251): on desktop, call `navigate(type === 'club' ? \`/messages/club/${roomId}\` : \`/messages/${roomId}\`, { state })` instead of `pushState`; keep the mobile branch navigating to the full-screen `/chat/:roomId` / `/club/:clubId` routes. Because the same `MessagesLayout` element backs both `/messages` and `/messages/:roomId`, React Router updates the URL and `useParams` without remounting the component — the panel swaps via the existing `routeRoomId` effect (line 88-92), which must now also handle the club param.

- [ ] **Step 2: Handle the club route param**

Add `const { clubId: routeClubId } = useParams()` (route `/messages/club/:clubId`). Extend the sync effect (line 88) so that when `routeClubId` is present it sets `activeRoomId=routeClubId` + `activeRoomType='club'`; when `routeRoomId` is present it sets `'chat'`; when neither, clears. `handleChatBack` (line 254) becomes `navigate('/messages')`.

- [ ] **Step 3: Verify** — `npm run lint` → 0, `npm run build` → 0.

- [ ] **Step 4: Manual QA** — Desktop: click a DM and a club in the sidebar → URL updates to `/messages/:id` / `/messages/club/:id`, panel swaps without a full reload, browser Back returns to the previous conversation then to `/messages`. Deep-link `/messages/club/:id` opens the club in-panel. Mobile width: clicking still navigates to the full-screen route.

- [ ] **Step 5: Commit**
```bash
git add src/pages/Dashboard/MessagesLayout.tsx
git commit -m "refactor(chat): use router navigation for inbox panel instead of history.pushState"
```

---

### Task 4: Derived inbox filtering — archived view, muted/deleted handling, unread badge

**Files:** Modify `src/pages/Dashboard/MessagesLayout.tsx`, `src/hooks/useUnreadChatCount.ts`

- [ ] **Step 1: Filtering predicates in `MessagesLayout`**

Add `const [showArchived, setShowArchived] = useState(false);`. Define a per-item predicate used when building `combinedList`:
- **Hidden by delete:** exclude items where `deletedBy?.includes(uid)` **unless** `unreadBy?.includes(uid)` (new activity overrides delete).
- **Archived split:** when `showArchived` is false, exclude `archivedBy?.includes(uid)`; when true, show **only** archived items.
- Apply to both the DM list (`filteredChatRooms`) and clubs (`filteredClubs`) before the merge/sort.

- [ ] **Step 2: Pinned-first sort**

Change `combinedList`'s sort so pinned conversations (`pinnedBy?.includes(uid)`) sort above unpinned, then by `updatedAt desc` within each group.

- [ ] **Step 3: Archived toggle affordance + open-clears-delete**

Add a small "Archived" entry at the top of the list (a row showing an archive glyph + count of archived items) that toggles `showArchived`; when in archived mode show a header row with a back-to-inbox control. In `openChat` (Task 3), fire-and-forget `markConversationRead(type==='club'?'clubs':'chatRooms', roomId, uid)` so opening a deleted/unread room clears both flags (the actual read-clear also still happens in the chat engine; this makes the inbox update instantly and un-deletes).

- [ ] **Step 4: Unread badge ignores muted + archived**

In `useUnreadChatCount.ts`, when tallying, skip a doc if `mutedBy?.includes(userId)` or `archivedBy?.includes(userId)`. Applies to both the DM and club listeners.

- [ ] **Step 5: Verify** — `npm run lint` → 0, `npm run build` → 0.

- [ ] **Step 6: Manual QA** — Archive a room (via Task 5 UI, or temporarily via console) → it leaves the main list, appears under Archived, and the nav unread badge drops if it was unread. Mute an unread room → stays in inbox, badge count drops by one. Delete a room → disappears; have the other account message it → it reappears (now unread). Pin a room → jumps to top.

- [ ] **Step 7: Commit**
```bash
git add src/pages/Dashboard/MessagesLayout.tsx src/hooks/useUnreadChatCount.ts
git commit -m "feat(chat): archived view, muted/deleted filtering, pinned-first inbox sort"
```

---

### Task 5: Multi-select UI + bulk action bar + confirm dialog

**Files:** Modify `src/pages/Dashboard/MessagesLayout.tsx`, `src/components/chat/SelectionToolbar.tsx`

- [ ] **Step 1: Make `SelectionToolbar` action-configurable (backward-compatible)**

Extend `SelectionToolbarProps` with an optional `actions?: { key: string; icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[]`. When `actions` is provided, render that set (icon buttons with titles) followed by Cancel; when absent, render the current delete+cancel markup unchanged (so the Phase 2 `ChatHeader` usage is untouched). Keep `count`/`onCancel`; make `onDelete` optional (only used by the legacy path).

- [ ] **Step 2: Selection state + entry gesture in `MessagesLayout`**

Add `const [selectMode, setSelectMode] = useState(false);` and `const [selectedRooms, setSelectedRooms] = useState<Map<string, ConvCollection>>(new Map())` (map id → collection so bulk ops know which collection each belongs to). Entry: desktop shows a hover checkbox on each row; mobile enters select mode on long-press (a `pointerdown` timer ≈500ms). Tapping a row in select mode toggles its membership instead of opening it. Selected rows get the spec's brand-pink/8% wash + mint check.

- [ ] **Step 2b: Guard the openChat path in select mode**

When `selectMode` is true, row `onClick` toggles selection and must NOT call `openChat`. Ensure the long-press timer is cleared on `pointerup`/`pointerleave` and that a long-press doesn't also fire the click-open.

- [ ] **Step 3: Bulk action bar**

When `selectMode` and `selectedRooms.size > 0`, render (in place of the sidebar header, or as a bar above the list) a `SelectionToolbar` with `actions`:
- **Pin** (`Pin`) → `bulkConversationOp(items, allPinned ? unpinConversation : pinConversation, uid)` (toggles: if every selected is already pinned, unpin; else pin).
- **Read/Unread** (`MailOpen`/`Mail`) → `markConversationRead` / `markConversationUnread` (toggle by majority-unread).
- **Mute** (`BellOff`/`Bell`) → mute/unmute toggle.
- **Archive** (`Archive`/`ArchiveRestore`) → archive/unarchive toggle (unarchive when in the archived view).
- **Delete** (`Trash2`, danger) → opens `ConfirmDialog`; on confirm, `bulkConversationOp(items, deleteConversationForUser, uid)`.
After any bulk op: `showToast` (with partial-failure count if any settle rejected), clear selection, exit select mode. Replace any native `confirm()` on this path with `ConfirmDialog`.

- [ ] **Step 4: Verify** — `npm run lint` → 0, `npm run build` → 0.

- [ ] **Step 5: Manual QA (Phase 3 milestone)** — Select 3+ conversations (mix of DMs and clubs): **Archive** them → they leave the main list, drop out of the unread badge, and are all present under the Archived view and restorable there. Mark-unread a read one → badge climbs. Mute → badge drops, row de-emphasized. Pin → sorts to top. Bulk Delete → themed dialog confirms, rooms vanish, re-message reappears one. Desktop hover-checkbox and mobile long-press both enter select mode; Cancel exits and clears.

- [ ] **Step 6: Commit**
```bash
git add src/pages/Dashboard/MessagesLayout.tsx src/components/chat/SelectionToolbar.tsx
git commit -m "feat(chat): inbox multi-select with bulk pin/read/mute/archive/delete"
```

---

### Task 6: Final Phase 3 verification

**Files:** none (verification only unless a fix is needed).

- [ ] **Step 1:** `npm run lint` → 0.
- [ ] **Step 2:** `npm run build` → 0.
- [ ] **Step 3:** `npm --prefix tests test` → all pass (Phase 2's 25 + Task 2's new suite).
- [ ] **Step 4:** Re-run the Task 5 milestone end-to-end with two accounts (archive/mute/pin/read/delete across DMs + clubs), plus Task 3's navigation smoke (deep-link, back button, mobile).
- [ ] **Step 5:** If any check fails, do not close Phase 3 — file the failure as a new task at the end of this plan, fix under its own commit, re-run Steps 1–4.

---

## Notes for the executor

- **Absent array = empty:** every predicate uses `?.includes(uid)` so a doc without the field behaves as "not muted/archived/pinned/deleted". No backfill/migration is needed.
- **No `updatedAt` on per-user writes** — this is load-bearing (inbox-reorder bug). The rules test in Task 2 Step 3 guards it; keep it green.
- **Delete is a hide, not a destroy** — no message docs are removed by the inbox delete; that remains the per-message pipeline in `useChatEngine`. Reappear-on-new-activity is via the `unreadBy` override in Task 4 Step 1.
- **Deploy rules in Task 2** — `firebase deploy --only firestore:rules` runs after the emulator suite passes (user decision for Phase 3). If CLI auth is unavailable in this environment, escalate to the user rather than skipping.
- **`SelectionToolbar` stays backward-compatible** — the Phase 2 `ChatHeader` calls it with `count/onDelete/onCancel`; that path must render identically after Task 5 Step 1.
