/**
 * One-time migration: Clear usernames that conflict with app routes.
 *
 * Usage:
 *   node clear_conflicting_usernames.mjs
 *
 * What it does:
 *   1. Reads all docs from the `usernames` Firestore collection
 *   2. Checks each against the CONFLICTING_NAMES set (route names)
 *   3. For matches: deletes `usernames/{name}` and clears `username` on the user doc
 *   4. Those users will be prompted to choose a new username next login
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

// ── Load Firebase config from .env ──
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// All known app routes and reserved names that conflict
const CONFLICTING_NAMES = new Set([
  // Public routes
  'careers', 'terms', 'privacy', 'login', 'signup', 'verification',
  // Dashboard routes
  'dashboard', 'community', 'search', 'sell', 'profile', 'messages',
  'chat', 'wishlist', 'notifications', 'admin', 'product',
  // Brand / system
  'nextbench', 'help', 'support', 'about', 'contact', 'api', 'app',
  'www', 'mail', 'blog', 'feed', 'explore', 'trending', 'marketplace',
  'null', 'undefined', 'mod', 'moderator', 'settings',
]);

async function main() {
  console.log('🔍 Scanning usernames collection for conflicts...\n');

  const snapshot = await getDocs(collection(db, 'usernames'));
  let cleared = 0;

  for (const usernameDoc of snapshot.docs) {
    const username = usernameDoc.id; // doc ID = lowercase username
    if (CONFLICTING_NAMES.has(username)) {
      const { userId } = usernameDoc.data();
      console.log(`  ⚠️  Conflict: "${username}" (owned by user ${userId})`);

      // Delete the username reservation
      await deleteDoc(doc(db, 'usernames', username));
      console.log(`     ✓ Deleted usernames/${username}`);

      // Clear the username field on the user doc
      if (userId) {
        await updateDoc(doc(db, 'users', userId), {
          username: null,
          updatedAt: serverTimestamp(),
        });
        console.log(`     ✓ Cleared username on users/${userId}`);
      }

      cleared++;
    }
  }

  if (cleared === 0) {
    console.log('✅ No conflicting usernames found. All clear!');
  } else {
    console.log(`\n✅ Done. Cleared ${cleared} conflicting username(s).`);
    console.log('   Those users will be asked to choose a new username on next login.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
