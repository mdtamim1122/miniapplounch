import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC_5lKF9eR0l7WOhLmDIe9fbnVPlMStM7s",
  authDomain: "miniapplounch.firebaseapp.com",
  projectId: "miniapplounch",
  storageBucket: "miniapplounch.firebasestorage.app",
  messagingSenderId: "488722794738",
  appId: "1:488722794738:web:56147b6d7fcac6aa74286b",
  measurementId: "G-QSNSDR74K1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let analytics = null;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { db, analytics };