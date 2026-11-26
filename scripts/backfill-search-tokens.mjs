#!/usr/bin/env node
/**
 * One-off backfill for `searchTokens`.
 *
 * The `index*SearchTokens` write triggers only index a document when it is *written*, and the
 * deployed project currently has no such triggers at all (see
 * `NEXTBENCH-wAPP/docs/deployment/functions-ownership.md`). After the triggers are deployed,
 * existing documents still have no `searchTokens`, so keyword search keeps returning nothing until
 * this script runs.
 *
 * It touches exactly one field (`searchTokens`) and mirrors `searchTokens()` from
 * `functions/src/index.ts`. It never writes any other field and never deletes documents.
 *
 * Usage (requires Application Default Credentials, e.g. `gcloud auth application-default login`):
 *   GOOGLE_CLOUD_PROJECT=nextbench-a11ed node scripts/backfill-search-tokens.mjs --dry-run
 *   GOOGLE_CLOUD_PROJECT=nextbench-a11ed node scripts/backfill-search-tokens.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const SEARCH_TOKEN_LIMIT = 60;
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 400;

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

/** Copied verbatim from functions/src/index.ts so the backfill writes the same tokens. */
function searchTokens(...values) {
  const tokens = new Set();
  const text = values.filter((value) => typeof value === 'string')
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  for (const word of text.split(/\s+/).filter(Boolean)) {
    for (let length = 2; length <= Math.min(10, word.length); length += 1) tokens.add(word.slice(0, length));
    if (tokens.size >= SEARCH_TOKEN_LIMIT) break;
  }
  return Array.from(tokens).slice(0, SEARCH_TOKEN_LIMIT);
}

function tokenFields(collection, data) {
  switch (collection) {
    case 'users': return [data.name, data.username, data.school];
    case 'products': return [data.title, data.category, typeof data.description === 'string' ? data.description.slice(0, 200) : '', data.sellerSchool];
    case 'posts': return [data.title, typeof data.content === 'string' ? data.content.slice(0, 200) : '', data.school];
    case 'clubs': return [data.name, ...(Array.isArray(data.tags) ? data.tags : []), data.school];
    default: return [];
  }
}

async function backfill(collection) {
  let scanned = 0;
  let updated = 0;
  let last = null;
  for (;;) {
    let query = db.collection(collection).orderBy('__name__').limit(PAGE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    const batch = db.batch();
    let batchWrites = 0;
    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data();
      const tokens = searchTokens(...tokenFields(collection, data));
      const current = Array.isArray(data.searchTokens) ? data.searchTokens : [];
      if (JSON.stringify(current) === JSON.stringify(tokens)) continue;
      updated += 1;
      batchWrites += 1;
      if (!DRY_RUN) {
        batch.update(doc.ref, { searchTokens: tokens, searchTokensUpdatedAt: FieldValue.serverTimestamp() });
      }
    }
    if (batchWrites > 0 && !DRY_RUN) await batch.commit();
    last = snap.docs[snap.docs.length - 1];
    console.log(`[${collection}] scanned=${scanned} ${DRY_RUN ? 'would update' : 'updated'}=${updated}`);
  }
  console.log(`[${collection}] done scanned=${scanned} ${DRY_RUN ? 'would update' : 'updated'}=${updated}`);
}

for (const collection of ['users', 'posts', 'products', 'clubs']) {
  await backfill(collection);
}
console.log(DRY_RUN ? 'Dry run complete — nothing written.' : 'Backfill complete.');
