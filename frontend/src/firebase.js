import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// PASTE YOUR FIREBASE CONFIG HERE FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyClou0eTKirnxqlUU4weCpZFhXh-YNxlQ4",
  authDomain: "ai-workspace-2aa76.firebaseapp.com",
  projectId: "ai-workspace-2aa76",
  storageBucket: "ai-workspace-2aa76.firebasestorage.app",
  messagingSenderId: "126844779624",
  appId: "1:126844779624:web:d2e2f462f5f264daf20fdd",
  measurementId: "G-1V6Q4QTDJK"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
