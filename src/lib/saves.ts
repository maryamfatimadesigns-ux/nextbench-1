import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { isBlockRelationship } from './blocks';

export interface SavedPost {
  id: string;
  userId: string;
  postId: string;
  savedAt: any;
}

export const savePost = async (userId: string, postId: string) => {
  const postSnap = await getDoc(doc(db, 'posts', postId));
  const authorId = postSnap.data()?.authorId;
  if (typeof authorId === 'string' && await isBlockRelationship(userId, authorId)) {
    throw new Error('BLOCKED: Cannot save this post.');
  }

  const q = query(
    collection(db, 'saved_posts'),
    where('userId', '==', userId),
    where('postId', '==', postId)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    await addDoc(collection(db, 'saved_posts'), {
      userId,
      postId,
      savedAt: serverTimestamp()
    });
  }
};

export const unsavePost = async (userId: string, postId: string) => {
  const q = query(
    collection(db, 'saved_posts'),
    where('userId', '==', userId),
    where('postId', '==', postId)
  );
  
  const snapshot = await getDocs(q);
  snapshot.forEach(async (docSnap) => {
    await deleteDoc(doc(db, 'saved_posts', docSnap.id));
  });
};
