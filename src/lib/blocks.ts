/**
 * Block System
 *
 * Collection: `blocks`
 * Doc shape: { blockerId, blockedId, createdAt }
 * Doc ID: `${blockerId}_${blockedId}` for easy lookup
 *
 * Instagram-style blocking:
 * - When A blocks B, B sees A as "User Not Found" everywhere
 * - Bidirectional unfollow on block
 * - Block check on DM creation, search, post views, etc.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  doc, setDoc, deleteDoc, serverTimestamp, getDoc,
  collection, query, where, onSnapshot, getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';

/**
 * Block a user — also removes follows in both directions
 */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const docId = `${blockerId}_${blockedId}`;
  await setDoc(doc(db, 'blocks', docId), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });

  // Bidirectional unfollow: remove blocker→blocked AND blocked→blocker follows
  const [q1, q2] = [
    query(
      collection(db, 'follows'),
      where('followerId', '==', blockerId),
      where('followingId', '==', blockedId)
    ),
    query(
      collection(db, 'follows'),
      where('followerId', '==', blockedId),
      where('followingId', '==', blockerId)
    ),
  ];

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const deletions = [
    ...snap1.docs.map(d => deleteDoc(d.ref)),
    ...snap2.docs.map(d => deleteDoc(d.ref)),
  ];
  if (deletions.length > 0) {
    await Promise.all(deletions);
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const docId = `${blockerId}_${blockedId}`;
  await deleteDoc(doc(db, 'blocks', docId));
}

/**
 * One-shot async check: does a block relationship exist in either direction?
 * Used for server-side verification (e.g., in DM creation).
 */
export async function isBlockRelationship(uid1: string, uid2: string): Promise<boolean> {
  const [doc1, doc2] = await Promise.all([
    getDoc(doc(db, 'blocks', `${uid1}_${uid2}`)),
    getDoc(doc(db, 'blocks', `${uid2}_${uid1}`)),
  ]);
  return doc1.exists() || doc2.exists();
}

/**
 * Hook: returns the set of user IDs blocked by the current user
 */
export function useBlockedIds(): Set<string> {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setBlockedIds(new Set());
      return;
    }

    const q = query(
      collection(db, 'blocks'),
      where('blockerId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.forEach((d) => ids.add(d.data().blockedId));
      setBlockedIds(ids);
    }, (err) => {
      console.warn('blocks: blocked IDs listener error (ignored):', err);
    });

    return () => unsub();
  }, [user?.uid]);

  return blockedIds;
}

/**
 * Hook: returns the set of user IDs who have blocked the current user
 */
export function useBlockedByIds(): Set<string> {
  const { user } = useAuth();
  const [blockedByIds, setBlockedByIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setBlockedByIds(new Set());
      return;
    }

    const q = query(
      collection(db, 'blocks'),
      where('blockedId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.forEach((d) => ids.add(d.data().blockerId));
      setBlockedByIds(ids);
    }, (err) => {
      console.warn('blocks: blockedBy IDs listener error (ignored):', err);
    });

    return () => unsub();
  }, [user?.uid]);

  return blockedByIds;
}

/**
 * Hook: combined set of all user IDs involved in any block relationship
 * (union of blockedIds and blockedByIds). Convenience for filtering.
 */
export function useAllBlockedUserIds(): Set<string> {
  const blockedIds = useBlockedIds();
  const blockedByIds = useBlockedByIds();

  return useMemo(() => {
    const s = new Set<string>();
    blockedIds.forEach(id => s.add(id));
    blockedByIds.forEach(id => s.add(id));
    return s;
  }, [blockedIds, blockedByIds]);
}


/**
 * Hook: block status between current user and a target user
 */
export function useBlockStatus(targetUserId?: string): {
  isBlocked: boolean;   // current user blocked target
  isBlockedBy: boolean; // target blocked current user
} {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);

  useEffect(() => {
    if (!user || !targetUserId || user.uid === targetUserId) {
      setIsBlocked(false);
      setIsBlockedBy(false);
      return;
    }

    // Check if current user blocked target
    const docId1 = `${user.uid}_${targetUserId}`;
    const unsub1 = onSnapshot(doc(db, 'blocks', docId1), (snap) => {
      setIsBlocked(snap.exists());
    }, (err) => {
      console.warn('blocks: isBlocked listener error (ignored):', err);
      setIsBlocked(false);
    });

    // Check if target blocked current user
    const docId2 = `${targetUserId}_${user.uid}`;
    const unsub2 = onSnapshot(doc(db, 'blocks', docId2), (snap) => {
      setIsBlockedBy(snap.exists());
    }, (err) => {
      console.warn('blocks: isBlockedBy listener error (ignored):', err);
      setIsBlockedBy(false);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [user?.uid, targetUserId]);

  return { isBlocked, isBlockedBy };
}
