import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const isValidFirebaseValue = (value) => {
  return value && !value.includes("mock-") && !value.includes("REPLACE_WITH_");
};

// PASTE YOUR FIREBASE CONFIG HERE FROM FIREBASE CONSOLE or set values in frontend/.env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "mock-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "mock-auth-domain",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "mock-project-id",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "mock-bucket",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "mock-sender",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "mock-app-id",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "mock-measurement"
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
