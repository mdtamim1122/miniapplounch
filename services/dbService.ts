
import { User, LeaderboardEntry, AppConfig, Task, PromoCode } from '../types';
import { db } from './firebase';
import { 
  doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, 
  increment, DocumentSnapshot, QuerySnapshot, DocumentData, getCountFromServer, 
  deleteDoc, arrayUnion, where, writeBatch, runTransaction, AggregateQuerySnapshot
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';
const SETTINGS_COLLECTION = 'settings';
const TASKS_COLLECTION = 'tasks';
const PROMOS_COLLECTION = 'promos';
const CONFIG_DOC = 'globalConfig';

const LOCAL_STORAGE_KEY = 'offline_db_users';
const getLocalDB = (): Record<string, User> => {
  try { return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}'); } catch { return {}; }
};
const saveLocalDB = (data: Record<string, User>) => {
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
};

// Reduced timeout to 1.5s to ensure instant UI load even if DB is down
const withTimeout = <T>(promise: Promise<T>, ms: number = 1500): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }).catch(err => { clearTimeout(timer); reject(err); });
  });
};

export const getUserData = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await withTimeout<DocumentSnapshot>(getDoc(userRef));
    if (userSnap.exists()) return userSnap.data() as User;
    return null;
  } catch (error) {
    return getLocalDB()[userId] || null;
  }
};

export const createUser = async (user: User): Promise<User> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    // Check existence first with timeout
    const existingSnap = await withTimeout<DocumentSnapshot>(getDoc(userRef));
    if (existingSnap.exists()) return existingSnap.data() as User;
    
    const batch = writeBatch(db);
    const config = await getAppConfig(); // Now failsafe
    let earnedFromReferrer = 0;

    if (user.referredBy && user.referredBy !== user.id) {
      const referrerRef = doc(db, USERS_COLLECTION, user.referredBy);
      const referrerSnap = await withTimeout<DocumentSnapshot>(getDoc(referrerRef)); // Safe check
      if (referrerSnap.exists()) {
          const bonus = user.isPremium ? (config.referralBonusPremium || 5000) : config.referralBonus;
          earnedFromReferrer = bonus;
          const today = new Date().toISOString().split('T')[0];
          batch.update(referrerRef, {
            balance: increment(bonus),
            referralCount: increment(1),
            totalReferralRewards: increment(bonus),
            lifetimeEarnings: increment(bonus),
            [`earningsHistory.${today}`]: increment(bonus)
          });
      }
    }

    const newUser: User = { 
        ...user, 
        balance: 0, 
        completedTasks: [],
        referralCount: 0,
        totalReferralRewards: 0,
        earnedFromReferrer,
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
  } catch (error) {
    console.warn("DB Create Failed, using Local Fallback", error);
    const local = getLocalDB();
    if (local[user.id]) return local[user.id];
    const newUser = { ...user, balance: 0, completedTasks: [], referralCount: 0, totalReferralRewards: 0, earnedFromReferrer: 0, adWatchCount: 0, totalAdWatchCount: 0, lifetimeEarnings: 0, lastAdWatchDate: new Date().toISOString().split('T')[0] };
    local[user.id] = newUser;
    saveLocalDB(local);
    return newUser;
  }
};

export const updateUserBalance = async (userId: string, amount: number): Promise<number> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const today = new Date().toISOString().split('T')[0];
    await withTimeout(updateDoc(userRef, {
      balance: increment(amount),
      lifetimeEarnings: increment(amount),
      [`earningsHistory.${today}`]: increment(amount)
    }));
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as User).balance : 0;
  } catch (e) { return 0; }
};

export const trackAdWatch = async (userId: string): Promise<{allowed: boolean, message?: string}> => {
  try {
    const config = await getAppConfig();
    const limit = config.dailyAdLimit || 20;
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await withTimeout<DocumentSnapshot>(getDoc(userRef));
    if (!snap.exists()) return { allowed: false };
    const data = snap.data() as User;
    const today = new Date().toISOString().split('T')[0];
    
    if (data.lastAdWatchDate !== today) {
       await updateDoc(userRef, { adWatchCount: 1, totalAdWatchCount: increment(1), lastAdWatchDate: today });
       return { allowed: true };
    }
    if ((data.adWatchCount || 0) >= limit) return { allowed: false, message: `Limit ${limit}/${limit}` };
    await updateDoc(userRef, { adWatchCount: increment(1), totalAdWatchCount: increment(1) });
    return { allowed: true };
  } catch (e) { return { allowed: false }; }
};

// --- PROMO CODE ---
export const createPromoCode = async (promo: PromoCode) => { await setDoc(doc(db, PROMOS_COLLECTION, promo.code), promo); };
export const getPromoCodes = async () => { 
  try { 
    const s = await withTimeout<QuerySnapshot>(getDocs(collection(db, PROMOS_COLLECTION))); 
    const r: PromoCode[]=[]; 
    s.forEach(d=>r.push(d.data() as PromoCode)); 
    return r; 
  } catch{ return []; } 
};
export const deletePromoCode = async (code: string) => { await deleteDoc(doc(db, PROMOS_COLLECTION, code)); };
export const redeemPromoCode = async (userId: string, code: string): Promise<{success: boolean, message: string}> => {
  try {
    const codeRef = doc(db, PROMOS_COLLECTION, code);
    const userRef = doc(db, USERS_COLLECTION, userId);
    return await withTimeout<{success: boolean, message: string}>(runTransaction(db, async (txn) => {
      const cSnap = await txn.get(codeRef);
      const uSnap = await txn.get(userRef);
      if (!cSnap.exists()) return { success: false, message: "Invalid Code" };
      const pData = cSnap.data() as PromoCode;
      const uData = uSnap.data() as User;
      
      if (!pData.isActive) return { success: false, message: "Code Inactive" };
      if (pData.maxUsers > 0 && pData.usedCount >= pData.maxUsers) return { success: false, message: "Code Limit Reached" };
      if (uData.redeemedCodes?.includes(code)) return { success: false, message: "Already Claimed" };

      const today = new Date().toISOString().split('T')[0];
      txn.update(userRef, {
        balance: increment(pData.reward),
        lifetimeEarnings: increment(pData.reward),
        [`earningsHistory.${today}`]: increment(pData.reward),
        redeemedCodes: arrayUnion(code)
      });
      txn.update(codeRef, { usedCount: increment(1) });
      return { success: true, message: `+${pData.reward} Points!` };
    }));
  } catch (e) { return { success: false, message: "Error or Offline" }; }
};

// --- REST ---
export const getReferredUsers = async (userId: string) => { 
  try { 
    if(!userId) return [];
    const q = query(collection(db, USERS_COLLECTION), where("referredBy", "==", userId)); 
    const s = await withTimeout<QuerySnapshot>(getDocs(q)); 
    const r: User[]=[]; 
    s.forEach(d=>r.push(d.data() as User)); 
    return r; 
  } catch{ return []; } 
};

export const getAllUsers = async (limitCount=100) => { 
  try { 
    const q = query(collection(db, USERS_COLLECTION), limit(limitCount)); 
    // removed orderBy to avoid index errors, sorting client side
    const s = await withTimeout<QuerySnapshot>(getDocs(q)); 
    const r: User[]=[]; 
    s.forEach(d=>d.exists()&&r.push(d.data() as User)); 
    return r.sort((a,b)=>b.balance-a.balance); 
  } catch{ return []; } 
};

export const searchUsers = async (term: string) => { 
  try { 
    const r: User[]=[]; 
    const dRef = doc(db, USERS_COLLECTION, term); 
    const dSnap = await withTimeout<DocumentSnapshot>(getDoc(dRef)); 
    if(dSnap.exists()) r.push(dSnap.data() as User); 
    
    // Only query if no direct match and not empty
    if(r.length === 0) {
        const q = query(collection(db, USERS_COLLECTION), where("username", "==", term)); 
        (await withTimeout<QuerySnapshot>(getDocs(q))).forEach(d=>{ if(!r.find(u=>u.id===d.id)) r.push(d.data() as User); }); 
    }
    return r; 
  } catch{ return []; } 
};

export const adminUpdateUser = async (uid: string, d: Partial<User>) => updateDoc(doc(db, USERS_COLLECTION, uid), d);

export const addTask = async (t: Task) => setDoc(doc(db, TASKS_COLLECTION, t.id), { ...t, createdAt: Date.now(), completedCount: 0, isActive: true });
export const deleteTask = async (id: string) => deleteDoc(doc(db, TASKS_COLLECTION, id));
export const toggleTaskStatus = async (id: string, s: boolean) => updateDoc(doc(db, TASKS_COLLECTION, id), { isActive: s });

export const getTasks = async () => { 
  try { 
    const s = await withTimeout<QuerySnapshot>(getDocs(query(collection(db, TASKS_COLLECTION)))); 
    const r: Task[]=[]; 
    s.forEach(d=>r.push(d.data() as Task)); 
    return r.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); 
  } catch{ return []; } 
};

export const claimTask = async (uid: string, t: Task) => { 
  try { 
    const uRef = doc(db, USERS_COLLECTION, uid); 
    const tRef = doc(db, TASKS_COLLECTION, t.id); 
    const today = new Date().toISOString().split('T')[0]; 
    return await withTimeout<{success: boolean, newBalance?: number}>(runTransaction(db, async (txn) => { 
      const uS = await txn.get(uRef); 
      const tS = await txn.get(tRef); 
      if(!uS.exists()||!tS.exists()) throw "Err"; 
      const uD = uS.data() as User; 
      const tD = tS.data() as Task; 
      if(uD.completedTasks?.includes(t.id)) return {success:false}; 
      if(!tD.isActive) return {success:false}; 
      if(tD.maxUsers && tD.maxUsers>0 && (tD.completedCount||0)>=tD.maxUsers) return {success:false}; 
      
      txn.update(uRef, { 
        balance: increment(t.reward), 
        completedTasks: arrayUnion(t.id), 
        lifetimeEarnings: increment(t.reward), 
        [`earningsHistory.${today}`]: increment(t.reward) 
      }); 
      txn.update(tRef, { completedCount: increment(1) }); 
      return {success:true, newBalance: (uD.balance||0)+t.reward}; 
    })); 
  } catch{ return {success:false}; } 
};

export const getLeaderboard = async () => { 
  try { 
    // Try simplified query first to avoid index issues
    const q = query(collection(db, USERS_COLLECTION), limit(100));
    const s = await withTimeout<QuerySnapshot>(getDocs(q)); 
    const r: LeaderboardEntry[]=[]; 
    let i=1; 
    s.forEach(d=>{ const u=d.data() as User; r.push({id:u.id, username:u.username, photoUrl:u.photoUrl, balance:u.balance, rank:0}); }); 
    // Sort client side
    return r.sort((a,b)=>b.balance-a.balance).map((u, idx) => ({...u, rank: idx+1}));
  } catch{ return []; } 
};

export const getAppConfig = async (): Promise<AppConfig> => { 
  const d = { adReward:150, referralBonus:1000, referralBonusPremium:5000, maintenanceMode:false, telegramChannelUrl:"", miniAppUrl:"", gigaPubId:"4473", dailyAdLimit:20 }; 
  try { 
    const s = await withTimeout<DocumentSnapshot>(getDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC))); 
    return s.exists() ? { ...d, ...s.data() } as AppConfig : d; 
  } catch (e) { 
    // Return default config instantly if offline/error
    return d; 
  } 
};

export const updateAppConfig = async (c: AppConfig) => setDoc(doc(db, SETTINGS_COLLECTION, CONFIG_DOC), c);
export const getTotalUserCount = async () => {
    try {
        const snap = await withTimeout<AggregateQuerySnapshot>(getCountFromServer(collection(db, USERS_COLLECTION)));
        return snap.data().count;
    } catch { return 0; }
};
