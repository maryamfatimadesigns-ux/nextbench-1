import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB7EBZmmkdOqePROf0UoJNfrNwbaRwpFdY",
  projectId: "nextbench-a11ed"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  const collections = ['schools', 'users', 'products', 'posts'];
  for (const col of collections) {
    console.log(`Migrating ${col}...`);
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      if (!d.data().city) {
        await updateDoc(doc(db, col, d.id), { city: 'Lucknow' });
      }
    }
  }
  console.log("Migration complete!");
}

migrate().catch(console.error);
