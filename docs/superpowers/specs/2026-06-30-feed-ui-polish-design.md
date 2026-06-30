# Feed UI Polish — Design Spec

**Date:** 2026-06-30
**Scope:** The whole feed experience (post cards + feed chrome), not just one component.

## Goal

Make the feed prettier, cozier to read, and more comfortable for human eyes — with
nicer icons and smooth, subtle animations. Substack is the *reference for smoothness
and reading comfort only*; this is NOT a Substack clone. The result must feel
distinctively Nextbench: warm, premium, Apple-clarity (see `DESIGN.md`).

## Decisions (locked with user)

- **Scope:** whole feed experience.
- **Typography:** full-serif reading feel — Playfair Display titles + **Source Serif 4** body.
- **Card style:** keep full-width edge-to-edge cards, refine the dividers (no floating cards).
- **Motion:** smooth & subtle (not bouncy, not dead-minimal).
- **Brand:** lean into Nextbench's warm/premium identity; smoothness like Substack, look like us.

## Design

### 1. Typography foundation (`src/index.css`)
- Add **Source Serif 4** to the existing Google Fonts `@import` (weights 400/500/600,
  italic 400). Keep Playfair Display.
- Expose a `--font-reading: "Source Serif 4", Georgia, serif;` token in the Tailwind v4
  `@theme` block so a `font-reading` utility is available. Playfair stays `font-serif`.
- Add a `prefers-reduced-motion` guard that neutralizes transitions/animations globally
  for motion-sensitive users.

### 2. Post card typography & reading comfort (`src/components/ui/PostCard.tsx`)
- **Title:** Playfair Display (`font-serif`), ~21px mobile / ~25px desktop, weight 600,
  tight leading, full ink color.
- **Body:** Source Serif 4 (`font-reading`), ~17px/18px, line-height ~1.7, ink `/75`
  (darker than today's faint `/60` — faint thin serif is the main eye-comfort killer).
- Preview clamp ~5 lines so each post reads like a real excerpt.
- Meta row, badges, action counts stay **Inter sans** (serif = content, sans = controls).
- Avatar gets a subtle ring; refined title→body→media→actions vertical rhythm.

### 3. Icons & action bar (`src/components/ui/PostCard.tsx`)
- Standardize all lucide icons to **1.75 stroke**, calmer sizes (action icons 24→22).
- Extend the soft rounded hover-pill (today only like/dislike) to comment + share + save
  for a unified, tactile row. Active states use brand tokens (pink like, teal save/comment).
- Align the hand-rolled downvote SVG stroke to match lucide so it stops looking like an outlier.

### 4. Motion (`PostCard.tsx`, `index.css`)
- Card entrance: gentle fade + 8px rise, design-system ease `[0.22,1,0.36,1]`.
- **Remove `layout` from the card** `motion.article` — it conflicts with the window
  virtualizer's `measureElement` and causes jitter. The fade alone is smoother.
- Soften taps (scale 0.8 → 0.92); unify hover transitions to 0.2s. Keep tab-underline
  spring and double-tap heart, calmed.

### 5. Responsiveness (`PostCard.tsx`)
- Responsive title/body sizes; ≥44px touch targets on mobile action buttons; action bar
  never wraps awkwardly on narrow screens; refine meta-row mobile truncation.

### 6. Feed chrome (`src/pages/Dashboard/Feed.tsx`)
- Polish sticky tab header, "What's on your mind?" compose bar, skeletons (serif-aware),
  empty + end-of-feed states, and the mobile FAB to match.
- Light consistency touch on `src/components/ui/ProductCard.tsx` so marketplace items sit
  naturally in the same feed.

## Files touched
- `src/index.css` — fonts, `--font-reading` token, reduced-motion guard, `.post-card-clean` refine.
- `src/components/ui/PostCard.tsx` — typography, icons, action bar, motion, responsive.
- `src/pages/Dashboard/Feed.tsx` — chrome, skeleton, states.
- `src/components/ui/ProductCard.tsx` — light consistency pass.

## Atomic commit plan
1. Typography foundation in CSS.
2. PostCard typography.
3. PostCard icons + action bar.
4. PostCard motion + responsiveness.
5. Feed chrome (tabs, compose, skeleton, states, FAB).
6. ProductCard consistency.

## Non-goals
- No change to global surface/brand color tokens (would affect every page outside the feed).
- No data/algorithm/behavior changes — purely presentational.
- No new dependencies beyond the Source Serif 4 web font.
