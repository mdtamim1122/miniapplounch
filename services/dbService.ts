import { User, LeaderboardEntry } from '../types';
import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  increment,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';

// --- LocalStorage Fallback System ---
// This ensures the app works immediately even if the Firestore API
// hasn't been enabled in the Google Cloud Console yet.

const LOCAL_STORAGE_KEY = 'offline_db_users';

const getLocalDB = (): Record<string, User> => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveLocalDB = (data: Record<string, User>) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage save failed", e);
  }
};

// --- Helper for Timeout ---
// If Firestore takes more than 2 seconds (due to network or perm issues), fallback to local.
const withTimeout = <T>(promise: Promise<T>, ms: number = 2000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// --- Database Operations ---

export const getUserData = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    // Wrap in timeout to prevent hanging white screen
    const userSnap = await withTimeout<DocumentSnapshot<DocumentData>>(getDoc(userRef));

    if (userSnap.exists()) {
      return userSnap.data() as User;
    }
    return null;
  } catch (error: any) {
    console.warn("Firestore error (using offline fallback):", error.message);
    const localData = getLocalDB();
    return localData[userId] || null;
  }
};

export const createUser = async (user: User): Promise<User> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    
    // Check referral logic (Firestore)
    let initialBalance = user.balance;
    if (user.referredBy && user.referredBy !== user.id) {
      initialBalance += 1000;
      // We don't await the referrer update to speed up signup
      const referrerRef = doc(db, USERS_COLLECTION, user.referredBy);
      updateDoc(referrerRef, {
        balance: increment(1000)
      }).catch(() => {});
    }

    const newUser: User = { ...user, balance: initialBalance };
    await withTimeout(setDoc(userRef, newUser));
    return newUser;
  } catch (error: any) {
    console.warn("Firestore create error (using offline fallback):", error.message);
    
    // LocalStorage Fallback
    const localData = getLocalDB();
    let initialBalance = user.balance;

    // Handle Referral in LocalStorage
    if (user.referredBy && user.referredBy !== user.id) {
       const referrer = localData[user.referredBy];
       if (referrer) {
         initialBalance += 1000;
         referrer.balance += 1000;
       }
    }

    const newUser: User = { ...user, balance: initialBalance };
    localData[user.id] = newUser;
    saveLocalDB(localData);
    return newUser;
  }
};

export const updateUserBalance = async (userId: string, amount: number): Promise<number> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    
    await withTimeout(updateDoc(userRef, {
      balance: increment(amount)
    }));

    // Fetch updated
    const userSnap = await withTimeout<DocumentSnapshot<DocumentData>>(getDoc(userRef));
    if (userSnap.exists()) {
      return (userSnap.data() as User).balance;
    }
    return 0;
  } catch (error: any) {
    console.warn("Firestore update error (using offline fallback):", error.message);
    
    const localData = getLocalDB();
    if (localData[userId]) {
      localData[userId].balance = (localData[userId].balance || 0) + amount;
      saveLocalDB(localData);
      return localData[userId].balance;
    }
    return 0;
  }
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy("balance", "desc"),
      limit(100)
    );

    const querySnapshot = await withTimeout<QuerySnapshot<DocumentData>>(getDocs(q));
    const leaderboard: LeaderboardEntry[] = [];
    
    let rank = 1;
    querySnapshot.forEach((doc) => {
      const data = doc.data() as User;
      leaderboard.push({
        id: data.id,
        username: data.username,
        photoUrl: data.photoUrl,
        balance: data.balance,
        rank: rank++
      });
    });

    return leaderboard;
  } catch (error: any) {
    console.warn("Firestore leaderboard error (using offline fallback):", error.message);
    
    const localData = getLocalDB();
    const sorted = Object.values(localData)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 100);

    return sorted.map((u, i) => ({
      id: u.id,
      username: u.username,
      photoUrl: u.photoUrl,
      balance: u.balance,
      rank: i + 1
    }));
  }
};