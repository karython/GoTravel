import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBm_OoYLjMp3vjXl9OhCXc7f_ixqD03mUw",
  authDomain: "gotravel-2f2d5.firebaseapp.com",
  projectId: "gotravel-2f2d5",
  storageBucket: "gotravel-2f2d5.firebasestorage.app",
  messagingSenderId: "109885596499",
  appId: "1:109885596499:web:18ed595fb0f735d4b137a6",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'gotravel-app';
