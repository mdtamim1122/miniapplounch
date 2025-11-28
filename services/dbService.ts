
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
  where,
  writeBatch
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
const withTimeout = <T>(promise: Promise<T>, ms: number = 3500): Promise<T> => {
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
    
    // Check if user already exists
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
        return existingSnap.data() as User;
    }
    
    const batch = writeBatch(db);
    let initialBalance = user.balance;
    const config = await getAppConfig();
    let earnedFromReferrer = 0;

    // REFERRAL LOGIC
    if (user.referredBy && user.referredBy !== user.id) {
      const referrerRef = doc(db, USERS_COLLECTION, user.referredBy);
      const referrerSnap = await getDoc(referrerRef);

      if (referrerSnap.exists()) {
          const bonusAmount = user.isPremium 
            ? (config.referralBonusPremium || config.referralBonus * 2) 
            : config.referralBonus;
            
          earnedFromReferrer = bonusAmount;

          batch.update(referrerRef, {
            balance: increment(bonusAmount),
            referralCount: increment(1),
            totalReferralRewards: increment(bonusAmount)
          });
      }
    }

    const newUser: User = { 
        ...user, 
        balance: initialBalance, 
        completedTasks: [],
        referralCount: 0,
        totalReferralRewards: 0,
        earnedFromReferrer: earnedFromReferrer,
        adWatchCount: 0,
        lastAdWatchDate: new Date().toISOString().split('T')[0]
    };
    batch.set(userRef, newUser);
    
    await withTimeout(batch.commit());
    
    return newUser;
  } catch (error: any) {
    console.error("Create User Error (Fallback Active)", error);
    const localData = getLocalDB();
    if (localData[user.id]) return localData[user.id];

    const config = await getAppConfig();
    let earnedFromReferrer = 0;

    if (user.referredBy && user.referredBy !== user.id) {
       const referrer = localData[user.referredBy];
       if (referrer) {
         const bonus = user.isPremium 
            ? (config.referralBonusPremium || config.referralBonus * 2) 
            : config.referralBonus;
         referrer.balance += bonus;
         referrer.referralCount = (referrer.referralCount || 0) + 1;
         referrer.totalReferralRewards = (referrer.totalReferralRewards || 0) + bonus;
         earnedFromReferrer = bonus;
       }
    }

    const newUser: User = { 
      ...user, 
      completedTasks: [], 
      referralCount: 0, 
      totalReferralRewards: 0,
      earnedFromReferrer: earnedFromReferrer,
      adWatchCount: 0,
      lastAdWatchDate: new Date().toISOString().split('T')[0]
    };
    localData[user.id] = newUser;
    saveLocalDB(localData);
    return newUser;
  }
};

export const getReferredUsers = async (userId: string): Promise<User[]> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), where("referredBy", "==", userId));
    const snap = await getDocs(q);
    const users: User[] = [];
    snap.forEach(doc => users.push(doc.data() as User));
    return users;
  } catch (e) {
    const local = getLocalDB();
    return Object.values(local).filter(u => u.referredBy === userId);
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

// --- AD WATCH TRACKING ---
export const trackAdWatch = async (userId: string): Promise<{allowed: boolean, message?: string}> => {
  try {
    const config = await getAppConfig();
    const limit = config.dailyAdLimit || 20;
    
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return { allowed: false, message: "User not found" };
    
    const userData = userSnap.data() as User;
    const today = new Date().toISOString().split('T')[0];
    
    // Reset if new day
    if (userData.lastAdWatchDate !== today) {
       await updateDoc(userRef, {
         adWatchCount: 1,
         lastAdWatchDate: today
       });
       return { allowed: true };
    }
    
    // Check limit
    if ((userData.adWatchCount || 0) >= limit) {
      return { allowed: false, message: `Daily limit reached (${limit}/${limit})` };
    }
    
    // Increment
    await updateDoc(userRef, {
      adWatchCount: increment(1)
    });
    
    return { allowed: true };
    
  } catch (e) {
    // Local Fallback
    const localData = getLocalDB();
    const user = localData[userId];
    const today = new Date().toISOString().split('T')[0];
    const limit = 20;
    
    if (user) {
      if (user.lastAdWatchDate !== today) {
        user.lastAdWatchDate = today;
        user.adWatchCount = 1;
        saveLocalDB(localData);
        return { allowed: true };
      }
      if ((user.adWatchCount || 0) >= limit) {
        return { allowed: false, message: "Daily limit reached (Offline)" };
      }
      user.adWatchCount = (user.adWatchCount || 0) + 1;
      saveLocalDB(localData);
      return { allowed: true };
    }
    return { allowed: false };
  }
};

// --- ADMIN USER MANAGEMENT ---

export const getAllUsers = async (limitCount = 100): Promise<User[]> => {
  try {
    // Simplified query: No orderBy to prevent Index Errors.
    const q = query(collection(db, USERS_COLLECTION), limit(limitCount));
    
    // Increased timeout for larger data sets
    const snap = await withTimeout<QuerySnapshot<DocumentData>>(getDocs(q), 5000);
    
    const users: User[] = [];
    snap.forEach(d => {
        const data = d.data();
        if (data && data.id) {
            users.push(data as User);
        }
    });
    
    // Client-side Sort
    return users.sort((a, b) => b.balance - a.balance);
  } catch (e) {
    console.error("Get All Users Error", e);
    const local = getLocalDB();
    return Object.values(local).slice(0, limitCount).sort((a, b) => b.balance - a.balance);
  }
};

export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  try {
    const users: User[] = [];
    
    // 1. Try ID
    const docRef = doc(db, USERS_COLLECTION, searchTerm);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      users.push(docSnap.data() as User);
    }

    // 2. Try Username
    const q = query(collection(db, USERS_COLLECTION), where("username", "==", searchTerm));
    const querySnap = await getDocs(q);
    querySnap.forEach(d => {
       if (!users.find(u => u.id === d.id)) {
         users.push(d.data() as User);
       }
    });

    return users;
  } catch (e) {
    console.error("Search failed", e);
    return [];
  }
};

export const adminUpdateUser = async (userId: string, data: Partial<User>): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, data);
  } catch (e) {
    throw e;
  }
};

// --- TASK MANAGEMENT ---

export const addTask = async (task: Task): Promise<void> => {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    await withTimeout(setDoc(taskRef, {
      ...task,
      createdAt: Date.now(),
      completedCount: 0,
      isActive: true, // Default active
      maxUsers: task.maxUsers || 0 // 0 means unlimited
    }));
  } catch (e) {
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

export const toggleTaskStatus = async (taskId: string, isActive: boolean): Promise<void> => {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    await updateDoc(taskRef, { isActive });
  } catch (e) {
    console.warn("Toggle task failed", e);
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
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    
    // 1. Check if user already completed
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      if (userData.completedTasks?.includes(task.id)) {
        return { success: false };
      }
    }
    
    // 2. Check Task Limits (Concurrency Check)
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
        const tData = taskSnap.data() as Task;
        // Check if inactive
        if (tData.isActive === false) return { success: false };
        // Check Max Users
        if (tData.maxUsers && tData.maxUsers > 0) {
            if ((tData.completedCount || 0) >= tData.maxUsers) {
                return { success: false };
            }
        }
    }

    const batch = writeBatch(db);

    // Update User
    batch.update(userRef, {
      balance: increment(task.reward),
      completedTasks: arrayUnion(task.id)
    });
    
    // Update Task (Count + Logic for Auto-Disable)
    batch.update(taskRef, {
        completedCount: increment(1)
    });

    await batch.commit();
    
    // 3. Post-Commit: Check if we need to disable the task
    // (We do this separately or could be in transaction/functions, doing here for simplicity)
    const updatedTaskSnap = await getDoc(taskRef);
    if (updatedTaskSnap.exists()) {
        const t = updatedTaskSnap.data() as Task;
        if (t.maxUsers && t.maxUsers > 0 && (t.completedCount || 0) >= t.maxUsers) {
            await updateDoc(taskRef, { isActive: false });
        }
    }

    const updatedUserSnap = await getDoc(userRef);
    return { success: true, newBalance: updatedUserSnap.data()?.balance };

  } catch (e) {
    // Local Fallback (Simplified)
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
    console.warn("Leaderboard fetch failed, using local fallback", error);
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
    referralBonusPremium: 5000,
    maintenanceMode: false,
    maintenanceEndTime: "",
    telegramChannelUrl: "https://t.me/GeminiGoldRush",
    botToken: "",
    miniAppUrl: "https://t.me/YourBotName/app",
    gigaPubId: "4473",
    dailyAdLimit: 20
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
