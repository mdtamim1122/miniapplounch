
import { User, LeaderboardEntry, AppConfig, Task } from '../types';
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
  getCountFromServer,
  deleteDoc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const SETTINGS_COLLECTION = 'settings';
const TASKS_COLLECTION = 'tasks';
const CONFIG_DOC = 'globalConfig';

// --- LocalStorage Fallback System ---
const LOCAL_STORAGE_KEY = 'offline_db_users';
const LOCAL_CONFIG_KEY = 'offline_app_config';
const LOCAL_TASKS_KEY = 'offline_tasks';

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
const withTimeout = <T>(promise: Promise<T>, ms: number = 2500): Promise<T> => {
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
    const config = await getAppConfig();

    // REFERRAL LOGIC: If user has a referredBy code, award bonus to referrer
    if (user.referredBy && user.referredBy !== user.id) {
      // Bonus to new user (optional, currently 0, but can be added here)
      // initialBalance += config.referralBonus; 
      
      // Bonus to Referrer
      const referrerRef = doc(db, USERS_COLLECTION, user.referredBy);
      updateDoc(referrerRef, {
        balance: increment(config.referralBonus)
      }).catch((e) => console.warn("Referral update failed", e));
    }

    const newUser: User = { ...user, balance: initialBalance, completedTasks: [] };
    await withTimeout(setDoc(userRef, newUser));
    return newUser;
  } catch (error: any) {
    const localData = getLocalDB();
    let initialBalance = user.balance;
    const config = await getAppConfig();

    if (user.referredBy && user.referredBy !== user.id) {
       const referrer = localData[user.referredBy];
       if (referrer) {
         referrer.balance += config.referralBonus; // Add bonus to referrer locally
       }
    }

    const newUser: User = { ...user, balance: initialBalance, completedTasks: [] };
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
    const localData = getLocalDB();
    if (localData[userId]) {
      localData[userId].balance = (localData[userId].balance || 0) + amount;
      saveLocalDB(localData);
      return localData[userId].balance;
    }
    return 0;
  }
};

// --- TASK MANAGEMENT ---

export const addTask = async (task: Task): Promise<void> => {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    await withTimeout(setDoc(taskRef, {
      ...task,
      createdAt: Date.now()
    }));
  } catch (e) {
    console.error("Add Task Failed", e);
    // Offline fallback for tasks
    const tasks = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || '[]');
    tasks.push(task);
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    await withTimeout(deleteDoc(taskRef));
  } catch (e) {
    const tasks = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || '[]');
    const newTasks = tasks.filter((t: Task) => t.id !== taskId);
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(newTasks));
  }
};

export const getTasks = async (): Promise<Task[]> => {
  try {
    const q = query(collection(db, TASKS_COLLECTION));
    const snap = await withTimeout<QuerySnapshot<DocumentData>>(getDocs(q));
    const tasks: Task[] = [];
    snap.forEach(doc => tasks.push(doc.data() as Task));
    return tasks.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    return JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || '[]');
  }
};

export const claimTask = async (userId: string, task: Task): Promise<{success: boolean, newBalance?: number}> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    
    // Check if already completed (double safety)
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      if (userData.completedTasks?.includes(task.id)) {
        return { success: false };
      }
    }

    // Atomic Update: Balance + Add Task ID
    await updateDoc(userRef, {
      balance: increment(task.reward),
      completedTasks: arrayUnion(task.id)
    });

    const updatedSnap = await getDoc(userRef);
    return { success: true, newBalance: updatedSnap.data()?.balance };

  } catch (e) {
    console.error("Claim Task Error", e);
    // Offline logic
    const localData = getLocalDB();
    const user = localData[userId];
    if (user) {
      if (!user.completedTasks) user.completedTasks = [];
      if (user.completedTasks.includes(task.id)) return { success: false };
      
      user.balance += task.reward;
      user.completedTasks.push(task.id);
      saveLocalDB(localData);
      return { success: true, newBalance: user.balance };
    }
    return { success: false };
  }
};

// --- LEADERBOARD & STATS ---

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

export const getAppConfig = async (): Promise<AppConfig> => {
  const defaultConfig: AppConfig = {
    adReward: 150,
    referralBonus: 1000,
    maintenanceMode: false,
    telegramChannelUrl: "https://t.me/GeminiGoldRush",
    botToken: "",
    miniAppUrl: "https://t.me/YourBotName/app" // Placeholder default
  };

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC);
    const snap = await withTimeout<DocumentSnapshot<DocumentData>>(getDoc(docRef));

    if (snap.exists()) {
      return { ...defaultConfig, ...snap.data() } as AppConfig;
    } else {
      await setDoc(docRef, defaultConfig);
      return defaultConfig;
    }
  } catch (e) {
    const localConfig = localStorage.getItem(LOCAL_CONFIG_KEY);
    return localConfig ? JSON.parse(localConfig) : defaultConfig;
  }
};

export const updateAppConfig = async (newConfig: AppConfig): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC);
    await withTimeout(setDoc(docRef, newConfig));
  } catch (e) {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(newConfig));
  }
};

export const getTotalUserCount = async (): Promise<number> => {
  try {
    const coll = collection(db, USERS_COLLECTION);
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
  } catch (e) {
    const localData = getLocalDB();
    return Object.keys(localData).length;
  }
};