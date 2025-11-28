
import { User, LeaderboardEntry, AppConfig, Task, PromoCode } from '../types';
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
  writeBatch,
  runTransaction
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const SETTINGS_COLLECTION = 'settings';
const TASKS_COLLECTION = 'tasks';
const PROMOS_COLLECTION = 'promos';
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
            totalReferralRewards: increment(bonusAmount),
            lifetimeEarnings: increment(bonusAmount),
            [`earningsHistory.${new Date().toISOString().split('T')[0]}`]: increment(bonusAmount)
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
        totalAdWatchCount: 0,
        lifetimeEarnings: 0,
        earningsHistory: {},
        redeemedCodes: [],
        lastAdWatchDate: new Date().toISOString().split('T')[0]
    };
    batch.set(userRef, newUser);
    
    await withTimeout(batch.commit());
    
    return newUser;
  } catch (error: any) {
    // Basic fallback without advanced logic
    console.error("Create User Error (Fallback Active)", error);
    const localData = getLocalDB();
    if (localData[user.id]) return localData[user.id];

    const newUser: User = { 
      ...user, 
      completedTasks: [], 
      referralCount: 0, 
      totalReferralRewards: 0,
      earnedFromReferrer: 0,
      adWatchCount: 0,
      totalAdWatchCount: 0,
      lifetimeEarnings: 0,
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

// Updated to track daily history
export const updateUserBalance = async (userId: string, amount: number): Promise<number> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const today = new Date().toISOString().split('T')[0];
    
    await withTimeout(updateDoc(userRef, {
      balance: increment(amount),
      lifetimeEarnings: increment(amount),
      [`earningsHistory.${today}`]: increment(amount)
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
         totalAdWatchCount: increment(1),
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
      adWatchCount: increment(1),
      totalAdWatchCount: increment(1)
    });
    
    return { allowed: true };
    
  } catch (e) {
    // Local Fallback
    return { allowed: false, message: "Offline mode limitation" };
  }
};

// --- PROMO CODE SYSTEM ---

export const createPromoCode = async (promo: PromoCode): Promise<void> => {
  try {
    // Use code as document ID for easy lookup
    await setDoc(doc(db, PROMOS_COLLECTION, promo.code), promo);
  } catch (e) {
    console.error("Failed to create promo code", e);
    throw e;
  }
};

export const getPromoCodes = async (): Promise<PromoCode[]> => {
  try {
    const snap = await getDocs(collection(db, PROMOS_COLLECTION));
    const codes: PromoCode[] = [];
    snap.forEach(d => codes.push(d.data() as PromoCode));
    return codes;
  } catch (e) {
    return [];
  }
};

export const deletePromoCode = async (code: string): Promise<void> => {
  await deleteDoc(doc(db, PROMOS_COLLECTION, code));
};

export const redeemPromoCode = async (userId: string, code: string): Promise<{success: boolean, message: string, newBalance?: number}> => {
  try {
    const codeRef = doc(db, PROMOS_COLLECTION, code);
    const userRef = doc(db, USERS_COLLECTION, userId);

    return await runTransaction(db, async (transaction) => {
      const codeSnap = await transaction.get(codeRef);
      const userSnap = await transaction.get(userRef);

      if (!codeSnap.exists()) {
        return { success: false, message: "Invalid promo code." };
      }
      
      const promoData = codeSnap.data() as PromoCode;
      const userData = userSnap.data() as User;

      // 1. Check Active
      if (!promoData.isActive) {
        return { success: false, message: "This code is inactive." };
      }

      // 2. Check Limit
      if (promoData.maxUsers > 0 && promoData.usedCount >= promoData.maxUsers) {
        return { success: false, message: "This code has reached its usage limit." };
      }

      // 3. Check if user already redeemed
      if (userData.redeemedCodes?.includes(code)) {
        return { success: false, message: "You have already claimed this code." };
      }

      // Apply Updates
      const today = new Date().toISOString().split('T')[0];
      
      transaction.update(userRef, {
        balance: increment(promoData.reward),
        lifetimeEarnings: increment(promoData.reward),
        [`earningsHistory.${today}`]: increment(promoData.reward),
        redeemedCodes: arrayUnion(code)
      });

      transaction.update(codeRef, {
        usedCount: increment(1)
      });

      return { 
        success: true, 
        message: `Success! +${promoData.reward} Points`, 
        newBalance: (userData.balance || 0) + promoData.reward 
      };
    });

  } catch (e: any) {
    console.error("Redeem error", e);
    return { success: false, message: "Error claiming code. Please try again." };
  }
};


// --- ADMIN USER MANAGEMENT ---

export const getAllUsers = async (limitCount = 100): Promise<User[]> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), limit(limitCount));
    const snap = await withTimeout<QuerySnapshot<DocumentData>>(getDocs(q), 5000);
    const users: User[] = [];
    snap.forEach(d => {
        if (d.exists()) users.push(d.data() as User);
    });
    return users.sort((a, b) => b.balance - a.balance);
  } catch (e) {
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
    return [];
  }
};

export const adminUpdateUser = async (userId: string, data: Partial<User>): Promise<void> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await updateDoc(userRef, data);
};

// --- TASK MANAGEMENT ---

export const addTask = async (task: Task): Promise<void> => {
  const taskRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(taskRef, {
    ...task,
    createdAt: Date.now(),
    completedCount: 0,
    isActive: true,
    maxUsers: task.maxUsers || 0
  });
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(taskRef);
};

export const toggleTaskStatus = async (taskId: string, isActive: boolean): Promise<void> => {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  await updateDoc(taskRef, { isActive });
};

export const getTasks = async (): Promise<Task[]> => {
  try {
    const q = query(collection(db, TASKS_COLLECTION));
    const snap = await getDocs(q);
    const tasks: Task[] = [];
    snap.forEach(doc => tasks.push(doc.data() as Task));
    return tasks.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    return [];
  }
};

export const claimTask = async (userId: string, task: Task): Promise<{success: boolean, newBalance?: number}> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    const today = new Date().toISOString().split('T')[0];

    return await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const taskSnap = await transaction.get(taskRef);
      
      if (!userSnap.exists() || !taskSnap.exists()) throw new Error("Not found");
      
      const userData = userSnap.data() as User;
      const taskData = taskSnap.data() as Task;

      // Checks
      if (userData.completedTasks?.includes(task.id)) return { success: false };
      if (taskData.isActive === false) return { success: false };
      if (taskData.maxUsers && taskData.maxUsers > 0 && (taskData.completedCount || 0) >= taskData.maxUsers) return { success: false };

      // Update
      transaction.update(userRef, {
        balance: increment(task.reward),
        completedTasks: arrayUnion(task.id),
        lifetimeEarnings: increment(task.reward),
        [`earningsHistory.${today}`]: increment(task.reward)
      });
      
      transaction.update(taskRef, {
        completedCount: increment(1)
      });
      
      return { success: true, newBalance: (userData.balance || 0) + task.reward };
    });
  } catch (e) {
    return { success: false };
  }
};

// --- CONFIG & UTILS ---

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy("balance", "desc"), limit(100));
    const querySnapshot = await getDocs(q);
    const leaderboard: LeaderboardEntry[] = [];
    let rank = 1;
    querySnapshot.forEach((doc) => {
      const data = doc.data() as User;
      leaderboard.push({ id: data.id, username: data.username, photoUrl: data.photoUrl, balance: data.balance, rank: rank++ });
    });
    return leaderboard;
  } catch (error: any) {
    return [];
  }
};

export const getAppConfig = async (): Promise<AppConfig> => {
  const defaultConfig: AppConfig = {
    adReward: 150,
    referralBonus: 1000,
    referralBonusPremium: 5000,
    maintenanceMode: false,
    telegramChannelUrl: "https://t.me/GeminiGoldRush",
    miniAppUrl: "https://t.me/YourBotName/app",
    gigaPubId: "4473",
    dailyAdLimit: 20
  };
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { ...defaultConfig, ...snap.data() } as AppConfig;
    await setDoc(docRef, defaultConfig);
    return defaultConfig;
  } catch (e) {
    return defaultConfig;
  }
};

export const updateAppConfig = async (newConfig: AppConfig): Promise<void> => {
  const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC);
  await setDoc(docRef, newConfig);
};

export const getTotalUserCount = async (): Promise<number> => {
  try {
    const snapshot = await getCountFromServer(collection(db, USERS_COLLECTION));
    return snapshot.data().count;
  } catch (e) {
    return 0;
  }
};
