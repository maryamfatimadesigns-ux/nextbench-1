import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';

export interface SavedPost {
  id: string;
  userId: string;
  postId: string;
  savedAt: any;
}

export const savePost = async (userId: string, postId: string) => {
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
