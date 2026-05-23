/**
 * Username System
 * 
 * Uses a `usernames` collection for uniqueness enforcement.
 * Each doc in `usernames` has ID = lowercase username, data = { userId, createdAt }
 * The user's doc in `users` also stores `username` for quick access.
 */

import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, query, where, getDocs, runTransaction
} from 'firebase/firestore';
import { db } from './firebase';

// Reserved words that cannot be used as usernames
const RESERVED_WORDS = new Set([
  'dashboard', 'login', 'signup', 'admin', 'sell', 'search', 'profile',
  'messages', 'chat', 'wishlist', 'notifications', 'community', 'verification',
  'terms', 'privacy', 'settings', 'product', 'nextbench', 'help', 'support',
  'about', 'contact', 'api', 'app', 'www', 'mail', 'blog', 'feed',
  'explore', 'trending', 'marketplace', 'null', 'undefined', 'mod', 'moderator',
]);

// Username validation regex: 3-20 chars, starts with letter, allows a-z, 0-9, _, .
const USERNAME_REGEX = /^[a-z][a-z0-9_.]{2,19}$/;

export interface UsernameValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate username format (does NOT check availability)
 */
export function validateUsername(username: string): UsernameValidation {
  const lower = username.toLowerCase();

  if (!username || username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }
  if (!USERNAME_REGEX.test(lower)) {
    return { valid: false, error: 'Only letters, numbers, underscores and dots. Must start with a letter.' };
  }
  if (lower.includes('..') || lower.includes('__')) {
    return { valid: false, error: 'Cannot use consecutive dots or underscores' };
  }
  if (lower.endsWith('.') || lower.endsWith('_')) {
    return { valid: false, error: 'Cannot end with a dot or underscore' };
  }
  if (RESERVED_WORDS.has(lower)) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}

/**
 * Check if a username is available
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const lower = username.toLowerCase();
  const docRef = doc(db, 'usernames', lower);
  const docSnap = await getDoc(docRef);
  return !docSnap.exists();
}

/**
 * Claim a username for a user (atomic transaction)
 * - Writes to `usernames/{username}` → { userId, createdAt }
 * - Updates `users/{userId}` → { username }
 * - If user already had a username, releases the old one
 */
export async function claimUsername(
  userId: string,
  username: string,
  oldUsername?: string | null
): Promise<void> {
  const lower = username.toLowerCase();

  await runTransaction(db, async (transaction) => {
    // Check the new username isn't taken
    const usernameRef = doc(db, 'usernames', lower);
    const usernameSnap = await transaction.get(usernameRef);
    
    if (usernameSnap.exists()) {
      const data = usernameSnap.data();
      if (data.userId !== userId) {
        throw new Error('Username is already taken');
      }
      // User already owns this username — no-op
      return;
    }

    const userRef = doc(db, 'users', userId);

    // Release old username if it exists
    if (oldUsername) {
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.lastUsernameChange) {
          // If changed within last 30 days, prevent change
          const lastChange = typeof userData.lastUsernameChange.toMillis === 'function' 
            ? userData.lastUsernameChange.toMillis() 
            : userData.lastUsernameChange;
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
          if (Date.now() - lastChange < thirtyDaysInMs) {
            throw new Error('You can only change your username once every 30 days.');
          }
        }
      }

      const oldRef = doc(db, 'usernames', oldUsername.toLowerCase());
      transaction.delete(oldRef);
    }

    // Claim new username
    transaction.set(usernameRef, {
      userId,
      createdAt: serverTimestamp(),
    });

    // Update user document
    transaction.update(userRef, {
      username: lower,
      lastUsernameChange: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Resolve a username to a user ID
 */
export async function getUserIdByUsername(username: string): Promise<string | null> {
  const lower = username.toLowerCase();
  const docRef = doc(db, 'usernames', lower);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data().userId;
  }
  return null;
}
