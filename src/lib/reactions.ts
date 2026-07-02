import { doc, runTransaction, serverTimestamp, setDoc, deleteDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';
import { isBlockRelationship } from './blocks';

// ─── Special Reactions System ────────────────────────────────

export type ReactionType = 'dead' | 'too_real' | 'exposed' | 'crazy' | 'wholesome' | 'spill_more' | 'respect';

export const REACTION_TYPES: Record<ReactionType, { emoji: string; weight: number; label: string }> = {
  dead: { emoji: '💀', weight: 2, label: 'Dead' },
  too_real: { emoji: '😭', weight: 3, label: 'Too Real' },
  exposed: { emoji: '👀', weight: 2, label: 'Exposed' },
  crazy: { emoji: '🤯', weight: 2, label: 'Crazy' },
  wholesome: { emoji: '❤️', weight: 3, label: 'Wholesome' },
  spill_more: { emoji: '☕', weight: 4, label: 'Spill More' },
  respect: { emoji: '🫡', weight: 2, label: 'Respect' }
};

export const REACTION_KEYS = Object.keys(REACTION_TYPES) as ReactionType[];

/**
 * Toggles a reaction for a post. If the user already has this exact reaction, it removes it.
 * If the user has a DIFFERENT reaction, it swaps it (by deleting old and adding new).
 * This maintains a "1 reaction per user per post" rule, but allows specific reaction types.
 */
export async function togglePostReaction(postId: string, userId: string, reaction: ReactionType) {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    const authorId = postSnap.data()?.authorId;
    if (typeof authorId === 'string' && await isBlockRelationship(userId, authorId)) {
      throw new Error('BLOCKED: Cannot react to this post.');
    }
    
    // We will query to see if the user already has ANY reaction for this post
    const q = query(
      collection(db, 'post_reactions'),
      where('postId', '==', postId),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    
    let existingReactionDoc = null;
    let existingReactionType: ReactionType | null = null;
    
    if (!snap.empty) {
      existingReactionDoc = snap.docs[0];
      existingReactionType = existingReactionDoc.data().reaction as ReactionType;
    }

    await runTransaction(db, async (transaction) => {
      const postDoc = await transaction.get(postRef);
      if (!postDoc.exists()) {
        throw new Error('Post does not exist!');
      }

      const postData = postDoc.data();
      const currentReactionsCount = postData.reactionsCount || {};
      
      const newReactionsCount = { ...currentReactionsCount };

      if (existingReactionType === reaction && existingReactionDoc) {
        // User clicked the same reaction -> REMOVE IT
        const reactionRef = doc(db, 'post_reactions', existingReactionDoc.id);
        transaction.delete(reactionRef);
        
        newReactionsCount[reaction] = Math.max(0, (newReactionsCount[reaction] || 0) - 1);
        
      } else {
        // User clicked a different reaction (or has no reaction)
        if (existingReactionDoc && existingReactionType) {
          // Remove old reaction
          const oldReactionRef = doc(db, 'post_reactions', existingReactionDoc.id);
          transaction.delete(oldReactionRef);
          newReactionsCount[existingReactionType] = Math.max(0, (newReactionsCount[existingReactionType] || 0) - 1);
        }
        
        // Add new reaction
        const newReactionRef = doc(collection(db, 'post_reactions'));
        transaction.set(newReactionRef, {
          userId,
          postId,
          reaction,
          createdAt: serverTimestamp()
        });
        
        newReactionsCount[reaction] = (newReactionsCount[reaction] || 0) + 1;
      }

      transaction.update(postRef, {
        reactionsCount: newReactionsCount,
        updatedAt: serverTimestamp()
      });
    });

  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
  }
}

/**
 * Gets the user's current reaction on a post (if any).
 */
export async function getUserReaction(postId: string, userId: string): Promise<ReactionType | null> {
  try {
    const q = query(
      collection(db, 'post_reactions'),
      where('postId', '==', postId),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data().reaction as ReactionType;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user reaction:', err);
    return null;
  }
}
