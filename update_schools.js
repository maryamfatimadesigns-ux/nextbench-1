import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./src/lib/firebase.ts', 'utf8').match(/const firebaseConfig = ({[\s\S]*?});/)[1].replace(/import\.meta\.env\.VITE_.*?/g, '""'));
// The above is hacky. Let me write a proper script using firebase-admin instead.
