import { User, LeaderboardEntry, AppConfig } from '../types';
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
  DocumentData,
  getCountFromServer
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const SETTINGS_COLLECTION = 'settings';
const CONFIG_DOC = 'globalConfig';

// --- LocalStorage Fallback System ---
const LOCAL_STORAGE_KEY = 'offline_db_users';
const LOCAL_CONFIG_KEY = 'offline_app_config';

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
    
    let initialBalance = user.balance;
    const config = await getAppConfig(); // Get dynamic referral bonus

    if (user.referredBy && user.referredBy !== user.id) {
      initialBalance += config.referralBonus;
      const referrerRef = doc(db, USERS_COLLECTION, user.referredBy);
      updateDoc(referrerRef, {
        balance: increment(config.referralBonus)
      }).catch(() => {});
    }

    const newUser: User = { ...user, balance: initialBalance };
    await withTimeout(setDoc(userRef, newUser));
    return newUser;
  } catch (error: any) {
    console.warn("Firestore create error (using offline fallback):", error.message);
    
    const localData = getLocalDB();
    let initialBalance = user.balance;
    const config = await getAppConfig();

    if (user.referredBy && user.referredBy !== user.id) {
       const referrer = localData[user.referredBy];
       if (referrer) {
         initialBalance += config.referralBonus;
         referrer.balance += config.referralBonus;
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

// --- ADMIN / CONFIG FUNCTIONS ---

export const getAppConfig = async (): Promise<AppConfig> => {
  const defaultConfig: AppConfig = {
    adReward: 150,
    referralBonus: 1000,
    maintenanceMode: false,
    telegramChannelUrl: "https://t.me/GeminiGoldRush"
  };

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC);
    const snap = await withTimeout<DocumentSnapshot<DocumentData>>(getDoc(docRef));

    if (snap.exists()) {
      return { ...defaultConfig, ...snap.data() } as AppConfig;
    } else {
      // Create if doesn't exist
      await setDoc(docRef, defaultConfig);
      return defaultConfig;
    }
  } catch (e) {
    // Return local or default if offline
    const localConfig = localStorage.getItem(LOCAL_CONFIG_KEY);
    return localConfig ? JSON.parse(localConfig) : defaultConfig;
  }
};

export const updateAppConfig = async (newConfig: AppConfig): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC);
    await withTimeout(setDoc(docRef, newConfig));
  } catch (e) {
    // Save locally if offline
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(newConfig));
    console.error("Failed to sync config online, saved locally");
  }
};

export const getTotalUserCount = async (): Promise<number> => {
  try {
    // Note: getCountFromServer is cost-effective but might fail offline
    // Fallback to fetching basic query
    const coll = collection(db, USERS_COLLECTION);
    const snapshot = await withCount(coll);
    return snapshot.data().count;
  } catch (e) {
    const localData = getLocalDB();
    return Object.keys(localData).length;
  }
};

// Helper for count (requires newer SDK, fallback logic if needed)
async function withCount(coll: any) {
  return await getCountFromServer(coll);
}
