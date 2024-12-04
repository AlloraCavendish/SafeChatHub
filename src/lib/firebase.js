
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "safechathub-7e7e9.firebaseapp.com",
  projectId: "safechathub-7e7e9",
  storageBucket: "safechathub-7e7e9.appspot.com",
  messagingSenderId: "795873987318",
  appId: "1:795873987318:web:e16ce4a47a530ab5acbad7",
  measurementId: "G-HPSL7ZKYZS"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth()
export const db = getFirestore()
export const storage = getStorage()

setPersistence(auth, browserLocalPersistence).catch(console.error);
