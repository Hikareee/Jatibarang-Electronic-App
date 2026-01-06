// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// Get these values from your Firebase Console: https://console.firebase.google.com/
// You can either set them as environment variables or replace the values directly
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAdmRPODj4ZD7E7zG77Mv2awu2BqvtKxCA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ibasa-kledo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ibasa-kledo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ibasa-kledo.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "659240087688",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:659240087688:web:43be3f7db2951ed73eef3d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PHLJGRCDYQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

