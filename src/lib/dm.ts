/**
 * Direct Messaging Utilities
 * 
 * Supports DM rooms independent of products.
 * DM rooms have `type: 'dm'` and no `productId`.
 */

import {
  collection, query, where, getDocs, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Find an existing DM room between two users, or create a new one.
 * Returns the room ID.
 */
export async function getOrCreateDMRoom(
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  // Search for existing DM rooms where both users are participants
  // We query for rooms where the current user is a participant and type is 'dm'
  const q = query(
    collection(db, 'chatRooms'),
    where('participants', 'array-contains', currentUserId),
    where('type', '==', 'dm')
  );

  const snap = await getDocs(q);

  // Check if any of these rooms also contain the other user
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.participants.includes(otherUserId)) {
      return doc.id;
    }
  }

  // No existing DM room — create one
  const newRoom = await addDoc(collection(db, 'chatRooms'), {
    participants: [currentUserId, otherUserId],
    type: 'dm',
    productId: '',
    productTitle: '',
    lastMessage: '',
    lastSenderId: '',
    updatedAt: serverTimestamp(),
  });

  return newRoom.id;
}
