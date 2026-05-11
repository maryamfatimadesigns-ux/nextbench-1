import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const firestoreDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DB || '(default)';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);
