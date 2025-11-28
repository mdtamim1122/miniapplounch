import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Configuration for 'miniapplounch'
const firebaseConfig = {
  apiKey: "AIzaSyC_5lKF9eR0l7WOhLmDIe9fbnVPlMStM7s",
  authDomain: "miniapplounch.firebaseapp.com",
  databaseURL: "https://miniapplounch-default-rtdb.firebaseio.com",
  projectId: "miniapplounch",
  storageBucket: "miniapplounch.firebasestorage.app",
  messagingSenderId: "488722794738",
  appId: "1:488722794738:web:044b499359a3c74974286b",
  measurementId: "G-M4N7FL3C1V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Analytics safely (it might fail in some environments or ad-blockers)
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Firebase Analytics could not be initialized:", e);
}

export { analytics };
