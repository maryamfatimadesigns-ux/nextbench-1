# 🔴 NextBench — Things To Fix

> **Comprehensive audit** of every reason NextBench isn't competitive with flagship social media apps (Instagram, X, Discord, Depop) in terms of **bugs**, **loading times**, **security**, and **architecture**.
>
> Organized into **7 phased fix plans**, ordered by severity and impact.

---

## 🔄 Audit Refresh — 2026-07-01

A fresh pass over the codebase found that **much of Phase 1 (security) and the biggest Phase 2 item have already been fixed** since the original audit. The lists below reconcile the document with the current code. New issues discovered in this pass are collected in **[Phase 8 — New Findings](#phase-8--new-findings-2026-07-01)**.

> ⚠️ Scope note: this refresh fully re-audited `firestore.rules`, `functions/src/index.ts`, `api/*`, and build/config. The React UI layer (pages/components) was only spot-checked — a full UI audit is still outstanding.

### ✅ Resolved since last audit (verify before deleting the section)

| Item | Evidence in current code |
|------|--------------------------|
| **1.1** `.env` committed | `git log --all -- .env` is empty — never committed; `.env` is gitignored. (Note: `VITE_*` Firebase web keys are *inherently* public in any client bundle — this is expected, not a leak.) |
| **1.2** Notification API no auth | `api/send-notification.js:50-62` now verifies a Firebase Bearer ID token + 10/min rate limit. (Residual issues → **8.3**.) |
| **1.3** Verify API no auth | `api/verify.ts:125-143` verifies Bearer token, enforces `verifiedUid === uid`, rate-limits 3/hr, and restricts CORS to `nextbench.in` + localhost. |
| **1.4** AdminPanel XSS | `AdminPanel.tsx:719` now renders `DOMPurify.sanitize(emailBodyHtml)`. |
| **1.8** Public read of all users | `firestore.rules:73-74` — `get` requires `canAccessUser()` (signed-in, block-aware); `list: if false`. |
| **1.9** `isAdmin` client field for authz | `firestore.rules:9` — `isAdmin()` now checks the **custom claim** `request.auth.token.admin == true`. |
| **1.10** No CSP / security headers | `vercel.json` now sets `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`. (CSP still allows `'unsafe-inline'`/`'unsafe-eval'` in `script-src` — hardening remains.) |
| **1.12** Client can create notifications for any user | `firestore.rules:387` — `allow create: if false`; creation moved to the server `createNotification` callable. (Residual spoofing → **8.4**.) |
| **1.13** Duplicate `reply_upvotes` rule blocks | Only one `match /reply_upvotes` block remains (`firestore.rules:472`). |
| **2.3** TF.js / NSFWJS in client bundle | Removed from `package.json`; `vite.config.ts` back to `chunkSizeWarningLimit: 500` and `maximumFileSizeToCacheInBytes: 2MB`. `imageModeration.ts` is now a server-delegating stub. |
| **4.3** Reply-image `createObjectURL` leak | `Feed.tsx:360` and `PostDetailModal.tsx:271-273` now use a `useMemo` + `revokeObjectURL` cleanup pattern. |

### ⚠️ Corrected / partially addressed (severity or framing changed — keep, with notes)

| Item | Correction |
|------|-----------|
| **1.5** Unsigned Cloudinary uploads | **Still unsigned.** `storage.ts:33,127` append `upload_preset` (unsigned preset); no server-generated `signature`. The code comment claims "authenticated/signed" but the request is not signed. Still a valid finding. |
| **1.6** Image moderation fails open | Client TF.js path is gone; `imageModeration.ts` now **returns `{ isSafe: true }` unconditionally** and defers to a Cloudinary moderation add-on. Whether that add-on is actually configured on the unsigned preset is **unverified** — if not, images are effectively unmoderated. Reframe as "moderation now depends entirely on an unverified server-side add-on." |
| **1.7** Text moderation client-only | **Server-side moderation now exists**: `moderatePost`/`moderateReply` triggers call Google NL `moderateText`. But it's *post-hoc* (content is briefly public before the trigger flips status), and the API key falls back to the client `VITE_FIREBASE_API_KEY` (`functions/src/index.ts:~1104`) which likely lacks Language API access → silent degrade to the tiny keyword list. |
| **1.11** No server-side write rate limiting | **Rate limiting now exists**: posts (5/5min), messages (30/min), replies (15/min), notifications (15/min), push (10/min), verify (3/hr). Residual weaknesses → **8.5**. |
| **2.10** SW precaches all assets | Still precaches all matched assets, but capped at 2MB (TF.js gone) with a documented rationale (avoid white-screen 404s on redeploy). Much smaller impact now. |
| **3.7** Both lockfiles present | **Still true** — `package-lock.json` and `pnpm-lock.yaml` both exist. |
| **5.6** Presence heartbeat cost | **Still true** — `presence.ts:18` heartbeat is `60_000`ms and `useOnlineCount` still subscribes to all `online == true` users. |
| **7.5 / 7.6** Moderation transparency / search | Partially addressed: server moderation exists (7.5) and `discovery.ts` + `searchDiscovery`/`searchPublicUsers` callables were added (7.6), but search is still prefix-based, not full-text, and there is still no rejection-reason/appeal UI. |

---

## Table of Contents

1. [Phase 1 — Critical Security Vulnerabilities](#phase-1--critical-security-vulnerabilities)
2. [Phase 2 — Performance & Loading Time Catastrophes](#phase-2--performance--loading-time-catastrophes)
3. [Phase 3 — Architecture & Code Quality Rot](#phase-3--architecture--code-quality-rot)
4. [Phase 4 — UX Bugs & Broken Interactions](#phase-4--ux-bugs--broken-interactions)
5. [Phase 5 — Data Integrity & Backend Gaps](#phase-5--data-integrity--backend-gaps)
6. [Phase 6 — Missing Production Infrastructure](#phase-6--missing-production-infrastructure)
7. [Phase 7 — Feature Parity Gaps vs. Flagship Social Apps](#phase-7--feature-parity-gaps-vs-flagship-social-apps)
8. [Phase 8 — New Findings (2026-07-01)](#phase-8--new-findings-2026-07-01)

---

## Phase 1 — Critical Security Vulnerabilities

These are **ship-stopping** issues. Any competent attacker can exploit these in under 30 minutes. No flagship app would ship with any of these.

---

### 1.1 — `.env` file committed with live Firebase credentials

**File**: `.env`

- The `.env` file containing `VITE_FIREBASE_API_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`, and other credentials is **tracked in the repository**.
- `.gitignore` does list `.env`, but the file already exists in the repo (once committed, gitignore doesn't retroactively remove it).
- **Impact**: Anyone cloning the repo has immediate access to the Firebase project and Cloudinary account.

**Fix**:
- Rotate ALL exposed credentials immediately.
- Verify `.env` is excluded from git history using `git log --all -- .env`.
- If found, use `git filter-repo` to scrub it from all branches/tags.
- Rotate Firebase API keys, Cloudinary preset, and all other secrets.

---

### 1.2 — Push notification API has ZERO authentication

**File**: `api/send-notification.js`

- The `/api/send-notification` Vercel serverless function accepts **any POST request** from **any origin** with `Access-Control-Allow-Origin: *`.
- No Firebase auth token verification, no API key, no CSRF token, no rate limiting.
- An attacker can spam push notifications to **any user** if they know (or brute-force) FCM tokens.

**Fix**:
- Verify the Firebase ID token from `Authorization: Bearer <token>` header using `admin.auth().verifyIdToken()`.
- Restrict CORS to `https://nextbench.in` only.
- Add per-user rate limiting (e.g., 10 notifications/minute).

---

### 1.3 — Verification API endpoint has ZERO authentication

**File**: `api/verify.ts`

- The `/api/verify` Vercel serverless function (AI-powered ID card verification) is fully open.
- `Access-Control-Allow-Origin: *` — any website can call it.
- No auth check — any anonymous user can trigger expensive Gemini API calls, consuming your API quota.
- Contains hardcoded fallback `projectId: 'nextbench-a11ed'` in source code.

**Fix**:
- Add Firebase ID token verification before processing.
- Rate limit per user (max 3 verification attempts/hour).
- Remove hardcoded project ID fallback from source code.
- Restrict CORS to production domain only.

---

### 1.4 — `dangerouslySetInnerHTML` without sanitization (XSS)

**File**: `src/pages/Dashboard/AdminPanel.tsx` (line 718)

```tsx
<div dangerouslySetInnerHTML={{ __html: emailBodyHtml }} />
```

- The admin email broadcast preview renders raw HTML without DOMPurify or any sanitization.
- If the admin panel is ever compromised (or an admin is tricked into pasting malicious HTML), this is a direct **Stored XSS** vector.

**Fix**:
- Install and use `DOMPurify.sanitize(emailBodyHtml)` before rendering.
- Apply CSP headers that block inline scripts.

---

### 1.5 — Cloudinary upload preset is unsigned (unauthenticated uploads)

**File**: `src/lib/storage.ts`

- All uploads use an **unsigned upload preset** (`VITE_CLOUDINARY_UPLOAD_PRESET`), meaning **anyone** with the cloud name and preset can upload arbitrary files to your Cloudinary account directly.
- No server-side validation of file type or content. The entire moderation pipeline is **client-side only** — trivially bypassed with `curl`.
- No file size enforcement on the server side.

**Fix**:
- Move to **signed uploads** using a server-side endpoint that generates Cloudinary signatures.
- Enforce file size limits, file type validation, and content moderation on the server (Cloud Function or Vercel serverless).
- Add Cloudinary webhook for post-upload moderation.

---

### 1.6 — Image moderation fails open (auto-approves on error)

**File**: `src/lib/imageModeration.ts` (lines 140-149)

```typescript
catch (err) {
  // If the model fails to load, we fail open
  return { isSafe: true, reason: 'Image moderation unavailable — auto-approved.' };
}
```

- If TensorFlow.js fails to load (ad blocker, CDN down, network error), **all images are auto-approved**.
- This is trivially exploitable: block the nsfwjs CDN → upload anything.
- The entire moderation system is **client-side only** — can be entirely bypassed by calling Cloudinary directly.

**Fix**:
- Move image moderation to the server (Cloudinary moderation add-on, or a Cloud Function with Google Cloud Vision API).
- On client-side failure, **queue the image for manual server-side review** instead of auto-approving.

---

### 1.7 — Text moderation is trivially bypassable

**File**: `src/lib/moderation.ts`

- Client-side-only word blacklist. Users can:
  - Bypass entirely by making Firestore writes directly (using the Firebase SDK from browser console).
  - Use Unicode homoglyphs not covered by the 18-character mapping table (Cyrillic а, е, о, etc.).
  - Use zero-width characters to break word matching.
- The banned list has only ~15 words — trivially incomplete for a social platform.

**Fix**:
- Move content moderation to Cloud Functions (`onDocumentCreated` trigger).
- Use Google Cloud Natural Language API or Perspective API for toxicity detection.
- Client-side check should be a UX convenience only, never a security boundary.

---

### 1.8 — Firestore rules allow public read of ALL user documents

**File**: `firestore.rules` (lines 50-51)

```
allow get: if true;
allow list: if true;
```

- **Any unauthenticated user** can read every user document in the database.
- This exposes: names, emails, schools, cities, profile pictures, ID card URLs, selfie URLs, verification status, admin status, FCM tokens, and more.
- Same issue with `posts` (line 366-367), `post_replies` (line 447-448), `products` (line 129-130), and `schools` (line 527).

**Fix**:
- Users collection: `allow get: if isSignedIn()` at minimum. Consider field-level access control (hide email, idCardUrl, selfieUrl from non-self, non-admin).
- Posts/products: `allow get: if true` is acceptable for public content, but `list` should be bounded (require a status filter).
- FCM tokens in user docs should be **removed** — store in a private subcollection like `users/{uid}/private/tokens`.

---

### 1.9 — Admin check relies on client-readable `isAdmin` field

**File**: `firestore.rules` (line 9)

- `isAdmin` is a field on the user document, readable by anyone (`allow get: if true`).
- While the Firestore rule `isAdmin()` function checks this correctly for write operations, the admin field itself is exposed publicly — attackers know exactly who the admins are.
- More importantly, the admin check in the client (`userData?.isAdmin`) controls UI rendering of the admin panel — if Firestore rules had a single flaw, privilege escalation would be trivial.

**Fix**:
- Use **Firebase Custom Claims** for admin roles (set via Admin SDK).
- Check `request.auth.token.admin == true` in rules instead of a document field.
- Custom claims are embedded in the auth token and can't be read by other users.

---

### 1.10 — No Content Security Policy (CSP) headers

**File**: `index.html`

- No CSP meta tag or server-side header.
- No `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy` headers.
- The site is vulnerable to clickjacking, MIME-type sniffing attacks, and more.

**Fix**:
- Add CSP headers via `vercel.json` or a Vercel middleware.
- Start with: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.cloudinary.com`.
- Add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000`.

---

### 1.11 — No rate limiting on Firestore client writes

- Any authenticated user can spam the database with unlimited writes (posts, messages, reactions, follows, notifications).
- Firestore rules check data validity but don't enforce write frequency.
- An attacker can create thousands of notifications for a target user, or spam posts/messages.

**Fix**:
- Add server-side rate limiting via Cloud Functions (e.g., `onDocumentCreated` triggers that check write frequency and delete excess).
- For critical paths (post creation, message sending), move writes behind a Cloud Function `onCall` that enforces per-user rate limits.

---

### 1.12 — Notifications can be created targeting ANY user

**File**: `firestore.rules` (lines 325-329)

```
allow create: if isSignedIn()
  && incoming().userId is string
  && incoming().type is string
  && incoming().title is string
  && incoming().read == false;
```

- Any signed-in user can create a notification document with **any `userId`** — they can spam notifications to any other user with arbitrary titles and messages.
- No validation that the notification relates to a real action.

**Fix**:
- Notification creation should be **server-side only** (Cloud Functions).
- Remove client `create` permission entirely from Firestore rules.
- Have Cloud Function triggers create notifications as a side effect of real actions (follows, upvotes, messages).

---

### 1.13 — Duplicate `reply_upvotes` Firestore rules override each other

**File**: `firestore.rules` (lines 414-419 and 474-478)

- Two `match /reply_upvotes/{upvoteId}` blocks with **different** delete rules. The second block is more permissive (doesn't check post author). Firestore uses the **last matching rule**, so the stricter delete rule on line 418 is silently overridden.

**Fix**:
- Remove the duplicate block. Keep only the stricter rule set.
- Add a comment explaining the intended access control.

---

## Phase 2 — Performance & Loading Time Catastrophes

Flagship apps load in under 1 second. NextBench has fundamental issues that cause multi-second load times and significant UI jank.

---

### 2.1 — Feed.tsx is a 2,791-line single-file monolith (122 KB)

**File**: `src/pages/Dashboard/Feed.tsx` — **2,791 lines, 122 KB**

- This single file contains: the post creation form, image cropper integration, poll creator, video upload, post detail modal, comment system (with nested threads), GIF picker, infinite scroll, feed scoring algorithm, all user interaction handlers, and every piece of state.
- **~60+ `useState` hooks** in the main `Feed` component alone.
- The component re-renders on virtually any state change, causing cascading re-renders of the entire post list.
- **Impact**: Massive JS parse time, massive memory footprint, impossible to code-split or tree-shake.

**Fix — Decompose into ~10-15 focused components and hooks**:
- `FeedPage.tsx` — orchestrator, < 200 lines
- `CreatePostModal.tsx` — post creation form, image/video upload, poll creator
- `PostDetailModal.tsx` — full post view, action bar
- `CommentThread.tsx` — nested comment display and input
- `GifPicker.tsx` — GIPHY integration
- `PollCreator.tsx` — poll choice editor
- `FeedList.tsx` — virtualized feed rendering
- Custom hooks:
  - `useFeedPosts.ts` — Firestore subscription, scoring, pagination
  - `useFeedActions.ts` — upvote, downvote, share, delete handlers
  - `useVoteSystem.ts` — upvote/downvote state management
  - `useComments.ts` — reply loading, submission, sorting

---

### 2.2 — Profile.tsx is 1,587 lines (79 KB), same monolith issue

**File**: `src/pages/Dashboard/Profile.tsx` — **1,587 lines, 79 KB**

- Same monolith problem: ~40+ useState hooks, inline modals, settings, followers/following lists, user posts, user listings, reviews — all in one file.
- Parse time alone is significant on mobile devices.

**Fix — Extract into composable components**:
- `ProfileHeader.tsx` — avatar, name, bio, follow button
- `FollowersModal.tsx` — followers/following list display
- `ProfileTabs.tsx` — tab switcher
- `ProfilePosts.tsx` — user's post grid
- `ProfileListings.tsx` — user's marketplace listings
- Custom hooks: `useProfileData.ts`, `useProfileActions.ts`

---

### 2.3 — TensorFlow.js + NSFWJS bundled in the client (6+ MB precache)

**Files**: `package.json`, `vite.config.ts` (line 103)

- `@tensorflow/tfjs` (4.22.0) and `nsfwjs` are in production dependencies.
- `chunkSizeWarningLimit: 6000` — this Vite warning was *suppressed* instead of fixing the root cause.
- `maximumFileSizeToCacheInBytes: 6 * 1024 * 1024` — the service worker precaches **6 MB chunks**.
- Even with code splitting into a separate `nsfwjs` chunk, the model loads on the client and downloads ~4 MB of model weight shards.
- **Impact**: Mobile users on slow connections wait 10+ seconds for the TF.js model. Battery drain is significant.

**Fix**:
- **Remove** TensorFlow.js and nsfwjs from the client bundle entirely.
- Move NSFW detection to a Cloud Function using Google Cloud Vision API, or use Cloudinary's built-in moderation add-on.
- This single change will reduce the total bundle by **~70%**.

---

### 2.4 — No image lazy loading or list virtualization

- The feed renders ALL visible posts + their images simultaneously. No windowing/virtualization (e.g., `react-window`, `react-virtuoso`).
- Images use Cloudinary `w_800` but no `loading="lazy"` attribute on most `<img>` tags.
- On a feed with 15 posts, each with images, the browser is decoding and painting dozens of images simultaneously.
- Profile pictures are fetched individually via Firestore `getDoc` inside each `Comment` component (N+1 query pattern).

**Fix**:
- Add `loading="lazy"` to all non-above-fold images.
- Implement virtualized scrolling for feed and chat message lists using `react-virtuoso` or similar.
- Batch-fetch profile pictures in a single query instead of per-comment individual `getDoc` calls.
- Use Cloudinary's responsive image transformations (`dpr_auto`, `w_auto`).

---

### 2.5 — 6+ simultaneous Firestore listeners on Feed mount

- Feed page alone opens **6+ simultaneous onSnapshot listeners** on mount:
  1. Posts collection (with author resolution — additional batch `getDocs` queries)
  2. Products collection (with seller resolution — additional batch `getDocs` queries)
  3. Post upvotes (user's upvoted posts)
  4. Post downvotes (user's downvoted posts)
  5. Saved posts (user's saved posts)
  6. Reply upvotes (user's reply upvotes)
  7. Wishlist items (user's wishlisted products)
- Each listener keeps a persistent WebSocket connection. On mobile, this drains battery and bandwidth.
- Upvotes/downvotes/saves are fetched with `getDocs` (one-shot) but reply upvotes use `onSnapshot` — inconsistent patterns.

**Fix**:
- Consolidate user-specific vote data into a single aggregated `onSnapshot` subscription or a batched Cloud Function endpoint.
- Cache vote data locally and sync periodically rather than maintaining 6+ live listeners.
- Consider a "user feed state" document pattern: `userFeedState/{userId}` containing all upvoted/downvoted/saved post IDs.

---

### 2.6 — Search page fetches 200 user documents on first render

**File**: `src/pages/Dashboard/Search.tsx` (line 79)

```typescript
getDocs(query(collection(db, 'users'), limit(200)))
```

- The search page downloads **200 full user documents** (with all fields: emails, school, verification data, FCM tokens, etc.) just to show "suggested users."
- This is done entirely client-side. There is no full-text search index (Algolia, Typesense, or Firestore text search extension).
- Search is a `string.includes()` filter on client-fetched data — won't scale past a few hundred users.
- **Billing impact**: 200 Firestore reads every time a user opens the search page.

**Fix**:
- Implement proper search with Algolia, Typesense, or Firestore's full-text search extension.
- For suggestions, create a lightweight Cloud Function that returns only necessary fields (name, avatar, school).
- Never expose 200 full user documents to the client.

---

### 2.7 — AdminPanel fires 9 full collection queries simultaneously on mount

**File**: `src/pages/Dashboard/AdminPanel.tsx` (lines 49-59)

- On mount, `fetchStats` fires **9 simultaneous `getDocs` calls** including full `users` collection scans and full `products` collection scans.
- On the "Users" tab, it fetches **ALL users** with no pagination.
- **Billing impact**: Every time an admin opens the panel, it reads every document in multiple collections.

**Fix**:
- Use `getCountFromServer()` for dashboard stats (Firestore has a dedicated count API).
- Implement server-side cursor-based pagination for user management.
- Create a dedicated admin stats Cloud Function that computes and caches stats.

---

### 2.8 — No bundle optimization (compression, tree-shaking, dynamic imports)

- `firebase` package is imported as a monolith (12.13.0). Even with the `firebase` manual chunk, the full SDK is large.
- No `vite-plugin-compression` for gzip/brotli pre-compression.
- No dynamic imports for heavy components like `ImageCropper`, `PollDisplay`, `PdfViewer`, `VideoPlayer`.
- 60+ individual `lucide-react` icon imports across the app — while each is small, they add up in parse time.

**Fix**:
- Add `vite-plugin-compression` for brotli/gzip pre-compression of all static assets.
- Lazy-load heavy components with `React.lazy()`: `ImageCropper`, `PdfViewer`, `VideoPlayer`, `PollDisplay`, `GifPicker`.
- Analyze the full bundle with `npx vite-bundle-visualizer` and eliminate dead code paths.
- Consider Firebase modular imports to reduce the Firebase chunk size.

---

### 2.9 — Landing page is a 44 KB single-file component

**File**: `src/pages/LandingPage.tsx` — **44,588 bytes**

- The landing page (the first thing unauthenticated users see) is a single massive component.
- It renders dozens of sections, animations, and data fetches on initial load.
- No above-the-fold / below-the-fold content splitting.

**Fix**:
- Split into above-the-fold hero section (instantly loaded) and lazy-loaded sections below.
- Use `Intersection Observer` to trigger loading of lower sections only when they scroll into view.
- Defer non-critical animations to after LCP.

---

### 2.10 — PWA service worker precaches ALL JS/CSS/HTML chunks

**File**: `vite.config.ts` (line 17)

```typescript
globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
```

- The service worker precaches **every single asset** on the first visit. With TF.js chunks, this could be 10+ MB total.
- Users on slow mobile connections will experience significant delays as the SW downloads everything in the background, competing with the main thread for bandwidth.

**Fix**:
- Only precache the app shell (main entry point, critical CSS, key fonts).
- Use **runtime caching** strategies (StaleWhileRevalidate, CacheFirst) for route chunks as the user navigates.
- Remove TF.js chunks from precache entirely (see 2.3).

---

## Phase 3 — Architecture & Code Quality Rot

These issues make the codebase unmaintainable, fragile, and prone to regressions. Flagship apps have strict architecture standards enforced by tooling.

---

### 3.1 — Pervasive `any` type usage (40+ files)

- Nearly every file in the codebase uses `any` types: `useState<any>`, function params typed as `any`, Firestore data cast to `any`.
- No shared type definitions for core entities (Post, User, Product, ChatRoom, Club, Message, Notification).
- The `Comment` component has `any` as its entire props type. Firestore snapshot data is always `d.data() as any`.

**Fix**:
- Create a `src/types/` directory with shared interfaces: `User`, `Post`, `Product`, `ChatRoom`, `ClubData`, `Message`, `Notification`, `Reply`.
- Gradually replace `any` with proper types across all files.
- Run `tsc --noEmit --strict` to surface all violations.
- Enable `strict: true` in `tsconfig.json`.

---

### 3.2 — Console statements left everywhere in production code

- **38+ files** contain `console.log`, `console.error`, or `console.warn` statements.
- These expose internal error details, Firestore collection paths, and state machine transitions to any user opening DevTools.
- Some `console.warn` calls leak error objects with stack traces.

**Fix**:
- Replace with a structured logging utility that is silent in production.
- Use `import.meta.env.DEV` guards for debug-only logging.
- Strip console calls in production build with a Vite plugin like `vite-plugin-strip` or `terserOptions.compress.drop_console`.

---

### 3.3 — Hardcoded school lists duplicated in multiple files

**Files**: `src/pages/Auth/Signup.tsx` (lines 12-21), `src/pages/Dashboard/Search.tsx` (lines 7-16)

- Two identical hardcoded school arrays in different files. If one is updated and the other isn't, they'll diverge and create inconsistency.
- The actual school list is fetched from Firestore's `schools` collection elsewhere, making these redundant.

**Fix**:
- Delete all hardcoded school arrays.
- Always fetch from Firestore `schools` collection.
- Create a `useSchools()` hook with client-side caching so the data is fetched once and shared.

---

### 3.4 — No shared state management or query caching

- Every page independently fetches its own data from Firestore, maintaining dozens of local `useState` hooks.
- No React Context for shared feed state, no query caching library (TanStack Query / SWR).
- Result: navigating from Feed to Profile and back **re-fetches everything from scratch**. Every navigation incurs full Firestore reads and loading spinners.

**Fix**:
- Adopt **TanStack Query (React Query)** for all Firestore data fetching — provides caching, deduplication, background refetching, optimistic updates, and stale-while-revalidate out of the box.
- Or use **Zustand** for lightweight global stores for frequently-accessed data (current user, vote state, following IDs).

---

### 3.5 — No test suite whatsoever

- Zero unit tests, zero integration tests, zero E2E tests.
- No test framework configured (`package.json` has no `test` script).
- Any refactoring or feature addition is a regression minefield — you can't safely change anything.

**Fix**:
- Set up **Vitest** (native to Vite) for unit/integration tests.
- Prioritize testing critical business logic first: feed scoring algorithm, text moderation, trending algorithm, vote counting, OTP generation.
- Add **Playwright** or **Cypress** for critical user flows: signup → verify → create post → view feed → send message.

---

### 3.6 — Scattered utility/migration scripts in project root

- Files like `clear_conflicting_usernames.mjs`, `migrate_city.mjs`, `update_schools.js`, `test-pfp.js`, `fix-iam.cjs`, `fix-iam.js`, `dummy.sh`, `fix-indexes.mjs`, `query-test.js` are in the project root.
- These aren't gitignored and pollute the project, making it harder to navigate and understand.

**Fix**:
- Move all scripts to a `scripts/` or `tools/` directory.
- Gitignore one-off migration scripts that shouldn't ship.
- Add a `README.md` in the scripts directory documenting what each script does.

---

### 3.7 — Both `package-lock.json` AND `pnpm-lock.yaml` exist

- Two package managers (npm and pnpm) have generated lock files, suggesting inconsistent tooling across developers or environments.
- This can cause dependency resolution differences and phantom bugs.

**Fix**:
- Choose one package manager and delete the other's lock file.
- Add an `engines` field to `package.json`.
- Add a `.npmrc` or equivalent to enforce the chosen package manager.
- Consider adding `only-allow` package to prevent accidental use of the wrong manager.

---

## Phase 4 — UX Bugs & Broken Interactions

---

### 4.1 — GIPHY API key missing from `.env`, GIF picker silently broken

- `VITE_GIPHY_API_KEY` is referenced in `Feed.tsx` (line 364) but not present in `.env` (only in `.env.example` as `your_actual_key_here`).
- The GIF picker will silently fail with API errors when users try to use it — they'll see "Trending GIFs loading..." forever.

**Fix**:
- Add the actual GIPHY API key to `.env`.
- Add a fallback UI when the key is missing or the API returns an error ("GIFs are currently unavailable").
- Consider moving GIPHY key to a server-side proxy to prevent exposure in client code.

---

### 4.2 — N+1 query pattern in comment avatar loading

**File**: `src/pages/Dashboard/Feed.tsx` (lines 169-177)

- Each `Comment` component fires a `getDoc` to fetch the user's profile picture if not already present — classic N+1 query problem.
- A post with 50 comments triggers 50 individual Firestore reads just for profile pictures.
- No caching between renders or across comments by the same author.

**Fix**:
- Batch-resolve all unique author profile pictures once when the replies list is loaded, using a single `where('__name__', 'in', authorIds)` query.
- Cache the results in a `Map` and pass them down to each `Comment` component as props.

---

### 4.3 — Reply image preview creates unrevoked object URLs (memory leak)

**File**: `src/pages/Dashboard/Feed.tsx` (line 647)

```tsx
<img src={URL.createObjectURL(replyImageFile)} />
```

- `URL.createObjectURL()` is called inline during render without `URL.revokeObjectURL()` cleanup.
- Each re-render creates a new blob URL that leaks memory until the page is unloaded.
- On long sessions with multiple image previews, this accumulates.

**Fix**:
- Use a `useMemo` + `useEffect` cleanup pattern:
  ```tsx
  const previewUrl = useMemo(() => replyImageFile ? URL.createObjectURL(replyImageFile) : null, [replyImageFile]);
  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);
  ```

---

### 4.4 — Feed limited to 15 posts with no real pagination (fake infinite scroll)

**File**: `src/pages/Dashboard/Feed.tsx` (line 944)

```typescript
limit(15)
```

- The feed Firestore query is hard-limited to 15 posts. The `InfiniteScrollSentinel` component exists and increases `visibleCount`, but it only controls which of the **already-fetched** 15 posts are visible — it doesn't fetch more data from Firestore.
- Users will see the same 15 posts forever, with no way to discover older content.
- This is a **fake infinite scroll** — it looks like it should work but doesn't actually load more data.

**Fix**:
- Implement proper Firestore cursor-based pagination using `startAfter(lastVisibleDoc)`.
- When the `InfiniteScrollSentinel` triggers, fire a new query with `startAfter()` and append results.
- Consider loading in batches of 10 and caching previous pages.

---

### 4.5 — `window.scrollTo(0, 0)` jank on ChatRoom mount

**File**: `src/pages/Dashboard/ChatRoom.tsx` (line 117)

- Scrolls the **entire page** to the top on ChatRoom mount. In a three-column dashboard layout, this is extremely jarring.
- Chat messages should auto-scroll to the bottom of the message container, not reset the entire page scroll position.

**Fix**:
- Replace with `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` to scroll within the chat container only.
- Don't touch `window.scrollTo` from a nested component.

---

### 4.6 — Location filter hardcoded to "Lucknow" only

**File**: `src/pages/Dashboard/Search.tsx` (line 18)

```typescript
const LOCATIONS = ["Lucknow"];
```

- The location filter dropdown only has "Lucknow." Any user from another city has no filtering option.
- As the platform expands, this will silently exclude all non-Lucknow users from search results.

**Fix**:
- Dynamically populate locations from the Firestore `schools` collection, extracting unique city values.
- Or maintain a `locations` collection in Firestore that admins can update.

---

### 4.7 — No offline fallback or error state for failed network requests

- When Firestore is unreachable (bad network, flight mode, etc.), the app shows a blank page or a perpetual loading spinner.
- No "You're offline" banner, no retry button, no display of cached data.
- The Firestore persistent cache helps with reads, but users get no visual feedback about their connectivity state.
- Failed writes (posts, messages) are silently lost.

**Fix**:
- Add a global network status listener (`navigator.onLine` + `online`/`offline` events).
- Show an offline banner when disconnected.
- Queue failed writes for retry when connectivity is restored (Firestore's `enableIndexedDbPersistence` helps with reads, but writes need explicit handling).
- Display cached data with a "you're viewing cached content" indicator.

---

## Phase 5 — Data Integrity & Backend Gaps

---

### 5.1 — Vote counts are client-managed with race conditions

- Upvote/downvote counts are incremented/decremented on the client via `updateDoc` with manual count arithmetic.
- Two users upvoting simultaneously can cause lost updates (classic read-modify-write race condition).
- No use of Firestore's atomic `increment()` field transform or transactions for vote counts.

**Fix**:
- Use `increment(1)` / `increment(-1)` for all counter fields (`upvotesCount`, `downvotesCount`, `repliesCount`, `sharesCount`).
- Or better yet: move vote counting to a Cloud Function trigger on `post_upvotes` document creation/deletion.
- This ensures counts are always accurate regardless of client behavior.

---

### 5.2 — No atomic operations for follow/unfollow (5-step non-transactional flow)

**File**: `src/lib/follows.ts` (lines 12-54)

- `followUser` does: query → check → `addDoc` → `getDoc` (user name) → `addDoc` (notification) — **5 separate operations** with no transaction.
- If the notification write fails (or any intermediate step fails), the follow is still recorded, leaving inconsistent state.
- `unfollowUser` deletes all matching docs but doesn't clean up follower/following count caches or notification records.

**Fix**:
- Wrap the entire follow/unfollow flow in a Firestore batch write or transaction.
- Or (preferred): move to a Cloud Function `onCall` that atomically handles the follow + notification + count updates server-side.

---

### 5.3 — Club member count will drift from reality

**File**: `src/lib/clubs.ts`

- `memberCount` is a separate field that's manually incremented/decremented alongside `memberIds` array modifications.
- If any operation fails halfway, or if `memberIds` is modified by multiple users simultaneously (race condition), `memberCount` will drift from `memberIds.length`.
- Over time, these numbers diverge silently.

**Fix**:
- Option A: Compute `memberCount` from `memberIds.length` on read (simpler, slightly slower).
- Option B: Use a Cloud Function trigger on `clubs/{clubId}` updates to atomically maintain the count.
- Option C: Use `arrayUnion`/`arrayRemove` with `increment()` in a batch write.

---

### 5.4 — No data retention or cleanup policies

- Deleted messages set `isDeletedForEveryone: true` but the document remains in Firestore **indefinitely** (still consuming storage and appearing in queries).
- Old notifications pile up forever with no expiry.
- Expired polls remain in the database.
- OTP rate limit documents in `emailOtpRateLimits` are never cleaned up.
- Inactive chat rooms and abandoned DM rooms accumulate.

**Fix**:
- Create a **scheduled Cloud Function** (daily or weekly) that:
  - Purges notification documents older than 90 days.
  - Hard-deletes soft-deleted messages older than 30 days.
  - Removes expired poll data.
  - Cleans up OTP rate limit docs older than 24 hours.
  - Archives or deletes chat rooms with no activity for 6+ months.

---

### 5.5 — Denormalized author data goes stale after profile updates

- Posts store `authorName`, `authorProfilePicture`, `school` at write time as denormalized copies.
- When a user updates their name, profile picture, or school, all their old posts/products still show the old data.
- The feed does a runtime resolution via a `userCache` (lines 947-989), but shared URLs, notifications, and other surfaces display stale denormalized names.

**Fix**:
- Create a Cloud Function trigger on `users/{uid}` updates that batch-updates denormalized fields in related posts, products, replies, and chat rooms.
- Alternatively, always resolve author data at read time (more reads, but always fresh).

---

### 5.6 — Presence heartbeat writes cost serious money at scale

**File**: `src/lib/presence.ts`

- Every online user writes to their user document **every 60 seconds** — that's **1,440 writes/day per active user**.
- With 1,000 DAU, that's **1.44 million writes/day** just for presence. Firestore charges $0.18 per 100K writes.
- `useOnlineCount` queries ALL users with `online == true` — reads the entire active user set every time.

**Fix**:
- Move presence to **Firebase Realtime Database (RTDB)**, which has built-in `onDisconnect` and is much cheaper for high-frequency writes (charged by bandwidth, not per-write).
- Or use a Cloud Function-based presence system with longer heartbeat intervals (5 min instead of 1 min).
- For online count, maintain a single server-side counter document rather than a client-side full-collection query.

---

## Phase 6 — Missing Production Infrastructure

Flagship social apps have entire teams maintaining this infrastructure. NextBench has none of it.

---

### 6.1 — No CI/CD pipeline

- No GitHub Actions workflow, no automated Vercel deployment hooks tied to testing, no checks on PRs.
- Any push to `main` could ship broken TypeScript, untested code, or security vulnerabilities directly to production.

**Fix**:
- Set up a GitHub Actions pipeline:
  1. TypeScript type checking (`tsc --noEmit`)
  2. Linting (`eslint`)
  3. Unit tests (`vitest run`)
  4. Production build (`vite build`)
  5. Deploy to Vercel preview on PR
  6. E2E tests against preview
  7. Deploy to production on merge to `main`

---

### 6.2 — No error tracking or crash monitoring

- No Sentry, no LogRocket, no Firebase Crashlytics for web.
- Production errors disappear silently into the void. Users see blank pages with no feedback.
- The `ErrorBoundary` component exists but only shows a generic UI — it doesn't report the error to any monitoring service.

**Fix**:
- Integrate **Sentry** for error tracking (free tier covers most needs).
- Add the Sentry Vite plugin for source map uploads.
- Connect the `ErrorBoundary` component to Sentry's `captureException`.
- Set up Slack/Discord alerts for new error types.

---

### 6.3 — No analytics or user behavior tracking

- No Firebase Analytics, no Mixpanel, no PostHog — not even basic page view tracking.
- No way to know what features are actually used, where users drop off in the signup funnel, or what the real performance looks like in the wild.

**Fix**:
- Integrate **Firebase Analytics** (free, already part of the Firebase SDK) or **PostHog** (generous free tier, privacy-friendly).
- Track key events: signup completion, post creation, message sent, product listed, search performed.
- Monitor funnel conversion rates.

---

### 6.4 — No Web Vitals monitoring

- No Core Web Vitals measurement (LCP, INP, CLS).
- No way to know if the site meets Google's "Good" thresholds.
- Given the bundle size (6+ MB with TF.js) and Firestore cold starts, LCP is almost certainly >4 seconds (rated "Poor").

**Fix**:
- Add the `web-vitals` library (tiny, tree-shakeable).
- Report metrics to your analytics service or a dedicated monitoring tool.
- Set performance budgets and fail CI if they're exceeded.

---

### 6.5 — No backup strategy for Firestore data

- No automated Firestore exports or backups.
- A single Firestore rule bug, a bad migration script (several exist in the root), or an admin mistake could permanently delete all user data.
- There is no recovery path.

**Fix**:
- Set up **automated daily Firestore exports** to Google Cloud Storage via a scheduled Cloud Function or the `gcloud firestore export` command.
- Configure Cloud Storage lifecycle rules to retain 30 days of backups.
- Test the restore process periodically.

---

### 6.6 — No staging/preview environment

- Only the production environment exists. Every change goes directly to live users.
- No way to safely test Firestore rule changes, Cloud Function updates, or UI changes before they hit real users.

**Fix**:
- Create a separate Firebase project for staging (e.g., `nextbench-staging`).
- Use Vercel preview deployments for PRs (automatically generated).
- Test Firestore rule changes against the staging project before deploying to production.
- Use Firebase Emulator Suite for local development.

---

## Phase 7 — Feature Parity Gaps vs. Flagship Social Apps

These aren't bugs — they're **missing table-stakes features** that every competitive social platform has. Users will expect these, and their absence makes the platform feel unfinished.

---

### 7.1 — No email verification flow for critical actions

- Users sign up with Google OAuth only. No email/password option with email verification for the account itself.
- While OTP verification exists for the "school email" flow, there's no protection against account takeover scenarios.

**Fix**: Support email/password signup with email verification. Add 2FA option for high-value accounts.

---

### 7.2 — No account deletion flow

- No way for users to delete their own account and all associated data. This is **legally required** under:
  - GDPR (EU)
  - India's Digital Personal Data Protection Act (DPDP)
  - Apple App Store guidelines (mandatory for any future iOS app)
  - Google Play Store guidelines

**Fix**: Implement a self-service account deletion flow. Create a Cloud Function that cascades deletion across all collections (posts, messages, follows, notifications, etc.).

---

### 7.3 — No password reset / account recovery

- If Google account access is lost, there's no recovery mechanism whatsoever.
- No "forgot password" flow (since there's no password-based auth).

**Fix**: If adding email/password auth, include a standard password reset flow. If staying Google-only, add a support contact for account recovery.

---

### 7.4 — No notification preferences / do-not-disturb

- Users can't mute specific notification types, set quiet hours, or selectively disable push notifications.
- It's all-or-nothing: you get every notification or none.

**Fix**: Add a notification preferences UI (profile settings → notifications) with per-type toggles: follows, messages, post reactions, mentions, admin notices.

---

### 7.5 — No content moderation queue transparency

- Posts go to "pending" status but users have no visibility into:
  - Why their post was rejected
  - How long review typically takes
  - The ability to appeal a rejection
  - What the content guidelines actually are

**Fix**: Add a "My Posts" section showing post status. Send a notification explaining rejection reasons. Publish community guidelines.

---

### 7.6 — No full-text search

- Search is a client-side `string.includes()` filter on pre-fetched data.
- No stemming, fuzzy matching, relevance ranking, or search suggestions.
- Doesn't scale past a few hundred users/posts.

**Fix**: Implement proper search with Algolia, Typesense, or Firestore's full-text search extension. Index posts, users, products, and clubs.

---

### 7.7 — No media compression/optimization pipeline

- Images are uploaded as-is to Cloudinary — no server-side resizing, no WebP/AVIF conversion, no thumbnail generation for feed cards vs. detail views.
- Cloudinary's `f_auto,q_auto` helps at display time, but storage still holds full-size originals.
- No video compression or transcoding pipeline.

**Fix**: Configure Cloudinary eager transformations to generate multiple sizes on upload. Create thumbnails (200px) for feed cards and medium sizes (800px) for detail views. Implement video transcoding for consistent playback.

---

### 7.8 — No read receipts in DMs

- Chat rooms track `unreadBy` at the room level, but individual messages have no delivery/read status.
- Users can't tell if their message was delivered, read, or even sent successfully.

**Fix**: Add `deliveredAt` and `readAt` timestamps to individual message documents. Show delivery/read indicators (✓ ✓✓) in the chat UI.

---

### 7.9 — No typing indicators

- No real-time "User is typing..." indicator in chat rooms or DMs.
- This is a basic chat feature that every messaging platform has.

**Fix**: Use a lightweight `chatRooms/{roomId}/typing/{userId}` document with a short TTL. Update on keypress, clear after 3 seconds of inactivity.

---

### 7.10 — No deep linking / Open Graph previews for shared content

- Shared post URLs (e.g., `nextbench.in/post/xyz`) are SPA routes — social media crawlers (Twitter, WhatsApp, Discord) will see an empty `<div id="root">` with generic OG tags.
- No server-side rendering or dynamic OG tag injection for shared content.
- Links shared on other platforms look like "Nextbench — The premiere verified student-to-student marketplace" regardless of what's being shared.

**Fix**: Implement dynamic OG tags via a Vercel Edge Function or Firebase Hosting rewrite. For each shared post/product, inject the title, description, and image into the HTML before it reaches the crawler.

---

### 7.11 — No accessibility (a11y) implementation

- No ARIA labels on interactive elements.
- No keyboard navigation support.
- No screen reader support.
- No focus management in modals and dropdowns.
- `select-none` is applied to the entire app body, preventing text selection everywhere.
- No skip-to-content link.
- No high-contrast mode support.

**Fix**: Audit with axe-core or Lighthouse accessibility audit. Add ARIA labels to all interactive elements. Implement keyboard navigation for modals, menus, and forms. Add focus trapping in modals. Remove the global `select-none`.

---

### 7.12 — No internationalization (i18n)

- All strings are hardcoded in English throughout the codebase.
- No localization framework.
- As the platform grows beyond English-speaking campuses, this becomes a blocker.

**Fix**: Adopt `react-i18next` or similar. Extract all UI strings into translation files. Start with English and Hindi for the current user base.

---

## Phase 8 — New Findings (2026-07-01)

Issues discovered in the 2026-07-01 refresh that were **not** in the original audit. Backend/rules items are verified against the current code; the React UI layer was only spot-checked, so 8.18–8.19 are not exhaustive.

---

### 8.1 — OTP login rotates the user's password on every sign-in and returns it to the client

**File**: `functions/src/index.ts` (`verifyAuthOtpEmail`, ~lines 479-484)

- To avoid the IAM `signBlob` permission needed for custom tokens, the callable calls `admin.auth().updateUser(uid, { password: loginPassword })` with a fresh random password on **every** successful OTP verification, then returns `loginPassword` in the response for the client to sign in with.
- Consequences: (a) any password the user set is silently destroyed each login; (b) a plaintext credential transits to the client; (c) the callable is unauthenticated, so passing OTP triggers a credential rotation for that account.

**Fix**: Grant the function's service account the *Service Account Token Creator* role and use `admin.auth().createCustomToken(uid)` instead of password rotation.

**Severity**: 🔴 High

---

### 8.2 — `unsubscribeFromEmails` lets anyone opt out any user by UID

**File**: `functions/src/index.ts` (`unsubscribeFromEmails`, ~lines 1068-1073)

- The callable takes a raw `uid` from `request.data` and does `users/{uid}.update({ emailOptOut: true })` with **no authentication and no signed token**. UIDs appear in unsubscribe links (`?uid=...`), so anyone can suppress email for any user, or mass-unsubscribe the user base.

**Fix**: Sign the unsubscribe URL with an HMAC of the UID and verify it before writing `emailOptOut`.

**Severity**: 🟠 Medium

---

### 8.3 — Push-notification API: hardcoded project fallback, unbounded token list, no ownership check

**File**: `api/send-notification.js` (lines 5, 105-127)

- Line 5 still hardcodes `|| 'nextbench-a11ed'` as a project-ID fallback (the `verify.ts` endpoint fixed this by throwing).
- The endpoint accepts an **unbounded `tokens` array** with no length cap and never checks that the tokens belong to the authenticated user — an authed user can push arbitrary notifications to any FCM tokens they supply, 10×/min.

**Fix**: Remove the hardcoded project-ID fallback; cap `tokens.length`; validate that each token is registered to the caller.

**Severity**: 🟠 Medium

---

### 8.4 — `createNotification` callable still allows spoofing non-admin notification types

**File**: `functions/src/index.ts` (`createNotification`, ~lines 1608-1658)

- The server callable correctly restricts sensitive types (`listing_approved`, `admin_promoted`, etc.) to admins, but it does **not** restrict ordinary types (`follow`, `message`) to legitimate actors. A signed-in user can forge a "someone followed you" / "new message" notification to **any** `userId`.

**Fix**: Have real triggers (on follow/message docs) create these notifications as side effects instead of accepting a client-specified type + target.

**Severity**: 🟠 Medium

---

### 8.5 — Rate limiters are reactive (delete-after-write) and fail open

**File**: `functions/src/index.ts` (`enforceRateLimit` ~1219-1249; `rateLimitPost`/`rateLimitMessage`/`rateLimitReply` ~1539-1606)

- Limits are enforced by `onDocumentCreated` triggers that **delete** the offending doc *after* it is written — so side-effect triggers (`notifyOnNewMessage`, `moderatePost`) can fire on a spam item before it's deleted.
- `enforceRateLimit` returns `true` (allow) on any error (line ~1247), so a Firestore hiccup disables all limits.

**Fix**: Enforce limits on a callable/write path *before* the write where possible; consider fail-closed above abusive volumes.

**Severity**: 🟠 Medium

---

### 8.6 — Any verified user can set arbitrary vote counts and overwrite poll results

**File**: `firestore.rules` (line 447)

```
(incoming().diff(existing()).affectedKeys().hasOnly(['upvotesCount', 'downvotesCount', 'repliesCount', 'reactionsCount', 'poll', 'updatedAt']))
```

- This branch lets **any** verified user update these fields on **any** post with **no value validation**. A user can set `upvotesCount` to any number, or overwrite the entire `poll` map — stuffing or wiping poll votes. This is the rules-level root cause behind the client-managed vote races in **5.1**.

**Fix**: Move counter/poll mutations behind Cloud Function triggers (atomic `increment()` on `post_upvotes` create/delete), and remove client write access to these fields — or at minimum constrain deltas to ±1.

**Severity**: 🔴 High

---

### 8.7 — `saved_posts` are readable and listable by any signed-in user

**File**: `firestore.rules` (lines 481-482)

```
allow read: if isSignedIn();
allow list: if isSignedIn();
```

- Unlike `wishlists`/`notifications`, the `saved_posts` read/list rules are **not scoped to the owner**. Any signed-in user can query the whole collection and see what every user has privately bookmarked.

**Fix**: Scope `read` to `resource.data.userId == request.auth.uid` and keep `list` gated by the same client-filter pattern used for notifications.

**Severity**: 🟠 Medium

---

### 8.8 — `school_requests` can be created unauthenticated

**File**: `firestore.rules` (lines 568-571)

- `allow create` has no `isSignedIn()` guard ("Allow unauthenticated create since this happens during signup"). Anyone can spam arbitrary `school_requests` with attacker-controlled `idCardUrl`/`requesterEmail` values, with no rate limit.

**Fix**: Require auth for the request (the signup user is authenticated by that point), or route it through a rate-limited callable.

**Severity**: 🟠 Medium

---

### 8.9 — Broad `list` permissions leak the social graph

**File**: `firestore.rules` (`follows` 535-536, `post_upvotes` 457-458, `reviews` 365-366, `usernames` 614-615, `wishlists` 353)

- These collections allow `list: if isSignedIn()` with no per-document constraint, so any signed-in user can enumerate who follows whom, who upvoted what, and every username→uid mapping.

**Fix**: Where the client only ever queries by a specific key, document that invariant and rely on it; otherwise restrict list access or expose aggregates via callables.

**Severity**: 🟡 Low–Medium

---

### 8.10 — Reviews have no purchase verification and a spoofable author name

**File**: `firestore.rules` (lines 368-375)

- `reviews` create only checks `reviewerId == request.auth.uid`. There's no proof the reviewer transacted with the seller, `reviewerName` is client-supplied (spoofable), and nothing prevents one user from posting unlimited reviews on the same product.

**Fix**: Gate review creation on a completed transaction record; derive `reviewerName` server-side; enforce one-review-per-user-per-product.

**Severity**: 🟡 Low

---

### 8.11 — `getLandingStats` reads up to 3,000 documents per call

**File**: `functions/src/index.ts` (`getLandingStats`, ~lines 1526-1537)

- This public callable computes `totalUsers/totalProducts/totalSchools` via `collection(...).limit(1000).get()` on three collections and returns `.size` — up to **3,000 billed reads on every landing-page load**, and the counts silently cap at 1000.

**Fix**: Use Firestore `.count().get()` aggregation queries (already used in the stray `functions/query-test.js`).

**Severity**: 🟠 Medium

---

### 8.12 — `broadcastEmail` is not idempotent — retries re-spam everyone

**File**: `functions/src/index.ts` (`broadcastEmail`, ~lines 994-1060)

- The idempotency guard doc (`emailBroadcasts/{broadcastId}`) is written only at line ~1054, **after** iterating up to 2000 users with `sleep(100ms)` each. Any timeout/crash/retry before that final `.set()` leaves no guard, so re-invocation with the same `broadcastId` re-emails everyone already sent.

**Fix**: Claim the broadcast doc (`create()` with status `in_progress`) *before* the loop and track per-recipient completion.

**Severity**: 🔴 High

---

### 8.13 — DM notification emails fire on every message with no unread check

**File**: `functions/src/index.ts` (`notifyOnNewMessage`, ~lines 747-810)

- Despite being named "Unread DM Notification," the trigger fires on every message create and only gates on `canSendEmail` (opt-out + `online === true` + 30-min cooldown). A user with the app backgrounded (`online === false`) gets an email every 30 minutes even while actively reading the conversation — there is no "receiver hasn't opened the room / message still unread" check.

**Fix**: Check the room's per-user `lastRead`/`unreadCount` for the receiver and skip if already seen.

**Severity**: 🟠 Medium

---

### 8.14 — Digest/broadcast jobs have no pagination (silent under-delivery + N+1)

**File**: `functions/src/index.ts` (`sendWeeklyDigest` `limit(500)` ~883; `broadcastEmail` `limit(2000)` ~998)

- Both jobs load a single non-paginated page of users, so once the base exceeds the cap everyone beyond it is silently never emailed. The digest also runs a `products` query per eligible user (N+1 reads).

**Fix**: Paginate with `startAfter` cursors over ordered queries; batch the per-user reads.

**Severity**: 🟠 Medium

---

### 8.15 — Referral count drifts between two independent code paths

**File**: `functions/src/index.ts` (signup path ~453-473 vs `submitInviteCode` ~538-598)

- The signup path sets `referredBy` and writes a `referrals/{uid}` subcollection doc but does **not** increment the referrer's `referralCount`. The separate `submitInviteCode` callable both sets `referredBy` and increments `referralCount`. So `referralCount` and the `referrals` subcollection size diverge depending on which path applied the code. The signup path also lacks the self-referral guard that `submitInviteCode` has.

**Fix**: Consolidate referral application into one transactional helper that sets `referredBy` and increments `referralCount` atomically, with a self-referral guard.

**Severity**: 🟠 Medium

---

### 8.16 — DM email CTA ships an unrendered template literal

**File**: `functions/src/index.ts` (~line 793; compiled at `functions/lib/index.js:689`)

```js
ctaText: "Reply to ${senderName} →"   // double quotes, not backticks
```

- Users receive the literal string `Reply to ${senderName} →` in the email button instead of the sender's name.

**Fix**: Use backticks: `` ctaText: `Reply to ${senderName} →` ``.

**Severity**: 🟢 Low

---

### 8.17 — Stray one-off scripts committed to `functions/`

**Files**: `functions/check-broadcast.js`, `functions/query-test.js`, `functions/test-options.ts`, `functions/test-resend.js`

- Ad-hoc scripts sit in the functions package. `check-broadcast.js` reads a field the code never writes (`doc.data().sentCount` vs the actual `recipientCount`), so it always logs `undefined`. `test-options.ts` defines an extra `testOptions` callable that, if picked up by the build, deploys a public no-op function. These are committed noise and a mild deploy risk (related to **3.6**).

**Fix**: Delete or move these out of the functions package; ensure `testOptions` is never deployed.

**Severity**: 🟢 Low

---

### 8.18 — ID/selfie/document preview object URLs are never revoked (memory leak)

**Files**: `src/pages/Auth/Verification.tsx` (lines 78, 104), `src/pages/Auth/OrgSignup.tsx` (line 70)

- `setIdPreview(URL.createObjectURL(file))`, the selfie preview, and the org-document preview create blob URLs with no matching `URL.revokeObjectURL()` on replacement/unmount. (Feed/ChatRoom/SellItem already fixed this pattern — these three files were missed.)

**Fix**: Apply the same `useMemo` + `useEffect` cleanup pattern used in `Feed.tsx:360`.

**Severity**: 🟢 Low

---

### 8.19 — Auth-gated actions use `window.location.href` full reloads instead of SPA navigation

**Files**: `Feed.tsx` (1005, 1089, 1175), `Search.tsx` (187, 204), `PostDetailModal.tsx` (397)

- Guest actions redirect via `window.location.href = '/login'`, forcing a full page reload that tears down the SPA (re-downloads the bundle, re-initializes Firebase, loses in-memory state) instead of `navigate('/login')`.

**Fix**: Use React Router's `useNavigate()` for in-app redirects.

**Severity**: 🟢 Low

---

## Execution Priority Matrix

| Priority | Phase | Description | Effort | Impact | Timeline |
|----------|-------|-------------|--------|--------|----------|
| 🔴 P0 | 1.1–1.13 | All security vulnerabilities | High | Critical | **Week 1-2** |
| 🔴 P0 | 2.3 | Remove TensorFlow.js from client | Medium | Very High | **Week 1** |
| 🟠 P1 | 2.1–2.2 | Decompose 2800-line and 1600-line monoliths | High | High | **Week 2-4** |
| 🟠 P1 | 5.1–5.2 | Fix data integrity race conditions | Medium | High | **Week 2-3** |
| 🟡 P2 | 2.4–2.10 | All performance optimizations | High | High | **Week 3-5** |
| 🟡 P2 | 6.1–6.3 | CI/CD, error tracking, analytics | Medium | Medium | **Week 3-4** |
| 🟢 P3 | 3.1–3.7 | Architecture & code quality cleanup | High | Medium | **Week 4-8** |
| 🟢 P3 | 4.1–4.7 | UX bugs and broken interactions | Medium | Medium | **Week 4-6** |
| 🔵 P4 | 7.1–7.12 | Feature parity with flagship apps | Very High | Medium | **Week 6-16** |
| 🔴 P0 | 8.1, 8.6, 8.12 | New criticals: OTP password-rotation, arbitrary vote/poll writes, non-idempotent broadcast | Medium | Critical | **Week 1** |
| 🟠 P1 | 8.2–8.5, 8.7–8.8, 8.11, 8.13–8.15 | New backend/rules security & cost gaps | Medium | High | **Week 2-4** |
| 🟢 P3 | 8.9–8.10, 8.16–8.19 | New low-severity rules/UI/cleanup items | Low | Low | **Week 4-8** |

---

> **Bottom line (updated 2026-07-01)**: The original Phase 1 was largely addressed — hardened Firestore rules (custom-claim admin, block-aware reads, server-only notifications), authenticated APIs, CSP + security headers, and removal of the 6 MB client-side ML pipeline (2.3). The remaining risk has shifted from "wide-open front door" to **subtler backend and rules-level integrity holes** (Phase 8): an OTP flow that rotates passwords (8.1), a rule that lets any user rewrite vote/poll counts (8.6), a broadcast that re-spams on retry (8.12), plus lingering architecture debt (monolithic `Feed.tsx`/`Profile.tsx`, no tests, no state caching) and the full Phase 7 feature-parity gap. Start the next pass with **8.1, 8.6, and 8.12**, then finish the residual items flagged in the Audit Refresh tables. A complete UI-layer audit is still outstanding.
