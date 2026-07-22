import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const isValidFirebaseValue = (value) => {
  return value && !value.includes("mock-") && !value.includes("REPLACE_WITH_");
};

// PASTE YOUR FIREBASE CONFIG HERE FROM FIREBASE CONSOLE or set values in frontend/.env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyClou0eTKirnxqlUU4weCpZFhXh-YNxlQ4",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "ai-workspace-2aa76.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "ai-workspace-2aa76",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "ai-workspace-2aa76.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "126844779624",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:126844779624:web:d2e2f462f5f264daf20fdd",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-1V6Q4QTDJK"
};

const missingConfig = Object.entries(firebaseConfig).filter(([, value]) => !isValidFirebaseValue(value));
if (missingConfig.length > 0) {
  console.warn(
    "⚠️ Firebase config is incomplete or using placeholders. Firebase Auth and Firestore may not work until valid frontend config values are provided."
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
