import { 
    doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, 
    query, limit, orderBy, writeBatch, arrayUnion, where,
    DocumentSnapshot, QuerySnapshot
  } from 'firebase/firestore';
  import { db } from './firebase';
  import { User, LeaderboardEntry, AppConfig, Task, PromoCode } from '../types';
  
  // Local Storage Keys for Offline Mode
  const LS_USERS = 'offline_users';
  const LS_TASKS = 'offline_tasks';
  const LS_PROMOS = 'offline_promos';
  const LS_CONFIG = 'offline_config';
  
  // --- HELPERS ---
  const getLocalCollection = <T>(key: string): Record<string, T> => {
      try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  };
  const saveLocalCollection = <T>(key: string, data: Record<string, T>) => {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  };
  
  // Helper to prevent hanging requests
  const withTimeout = async <T>(promise: Promise<T>, ms = 2000): Promise<T> => {
    let timeoutId;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };
  
  // --- USER FUNCTIONS ---
  
  export const getUserData = async (userId: string): Promise<User | null> => {
    try {
      // @ts-ignore
      const snap = await withTimeout(getDoc(doc(db, "users", userId))) as DocumentSnapshot;
      if (snap.exists()) return snap.data() as User;
      return null;
    } catch (error) {
      console.warn("DB offline, using local storage");
      const users = getLocalCollection<User>(LS_USERS);
      return users[userId] || null;
    }
  };
  
  export const createUser = async (user: User): Promise<User> => {
    const newUser: User = { 
        ...user, 
        balance: 0, 
        completedTasks: [],
        referralCount: 0,
        totalReferralRewards: 0,
        earnedFromReferrer: 0,
        adWatchCount: 0,
        totalAdWatchCount: 0,
        lifetimeEarnings: 0,
        earningsHistory: {},
        redeemedCodes: [],
        lastAdWatchDate: new Date().toISOString().split('T')[0]
    };
  
    try {
      const existing = await getUserData(user.id);
      if (existing) return existing;
  
      const config = await getAppConfig();
      // @ts-ignore
      const batch = writeBatch(db);
      
      // Referral Logic
      if (user.referredBy && user.referredBy !== user.id) {
          // Check if referrer exists
          // @ts-ignore
          const refSnap = await getDoc(doc(db, "users", user.referredBy));
          if (refSnap.exists()) {
              const bonus = user.isPremium ? (config.referralBonusPremium || 5000) : config.referralBonus;
              newUser.earnedFromReferrer = bonus;
              const today = new Date().toISOString().split('T')[0];
  
              // @ts-ignore
              batch.update(doc(db, "users", user.referredBy), {
                  balance: increment(bonus),
                  referralCount: increment(1),
                  totalReferralRewards: increment(bonus),
                  lifetimeEarnings: increment(bonus),
                  [`earningsHistory.${today}`]: increment(bonus)
              });
          }
      }
      // @ts-ignore
      batch.set(doc(db, "users", user.id), newUser);
      await withTimeout(batch.commit());
      return newUser;
  
    } catch (error) {
      // Fallback
      const users = getLocalCollection<User>(LS_USERS);
      users[user.id] = newUser;
      
      if (user.referredBy && users[user.referredBy]) {
         const refUser = users[user.referredBy];
         const bonus = 1000; // Default local bonus
         refUser.balance += bonus;
         refUser.referralCount = (refUser.referralCount || 0) + 1;
         refUser.totalReferralRewards = (refUser.totalReferralRewards || 0) + bonus;
         refUser.lifetimeEarnings = (refUser.lifetimeEarnings || 0) + bonus;
         newUser.earnedFromReferrer = bonus;
      }
      
      saveLocalCollection(LS_USERS, users);
      return newUser;
    }
  };
  
  export const updateUserBalance = async (userId: string, amount: number): Promise<number> => {
    const today = new Date().toISOString().split('T')[0];
    try {
      // @ts-ignore
      await withTimeout(updateDoc(doc(db, "users", userId), {
          balance: increment(amount),
          lifetimeEarnings: increment(amount),
          [`earningsHistory.${today}`]: increment(amount)
      }));
      const u = await getUserData(userId);
      return u ? u.balance : 0;
    } catch (e) {
      const users = getLocalCollection<User>(LS_USERS);
      if (users[userId]) {
          users[userId].balance += amount;
          users[userId].lifetimeEarnings = (users[userId].lifetimeEarnings || 0) + amount;
          users[userId].earningsHistory = users[userId].earningsHistory || {};
          users[userId].earningsHistory[today] = (users[userId].earningsHistory[today] || 0) + amount;
          saveLocalCollection(LS_USERS, users);
          return users[userId].balance;
      }
      return 0;
    }
  };
  
  export const trackAdWatch = async (userId: string): Promise<{allowed: boolean, message?: string}> => {
    const config = await getAppConfig();
    const limit = config.dailyAdLimit || 100;
    const today = new Date().toISOString().split('T')[0];
  
    try {
      // @ts-ignore
      const snap = await getDoc(doc(db, "users", userId));
      if (!snap.exists()) return {allowed: false};
      const user = snap.data() as User;
  
      if (user.lastAdWatchDate !== today) {
           // @ts-ignore
           await updateDoc(doc(db, "users", userId), {
              adWatchCount: 1,
              lastAdWatchDate: today,
              totalAdWatchCount: increment(1)
           });
           return { allowed: true };
      }
  
      if ((user.adWatchCount || 0) >= limit) {
          return { allowed: false, message: `Limit ${limit}/${limit}` };
      }
  
      // @ts-ignore
      await updateDoc(doc(db, "users", userId), {
          adWatchCount: increment(1),
          totalAdWatchCount: increment(1)
      });
      return { allowed: true };
    } catch (e) {
      // Local fallback
      const users = getLocalCollection<User>(LS_USERS);
      const user = users[userId];
      if (user) {
          if (user.lastAdWatchDate !== today) {
              user.adWatchCount = 1;
              user.lastAdWatchDate = today;
              user.totalAdWatchCount = (user.totalAdWatchCount || 0) + 1;
              saveLocalCollection(LS_USERS, users);
              return { allowed: true };
          }
          if ((user.adWatchCount || 0) >= limit) return { allowed: false, message: `Limit ${limit}/${limit}` };
          user.adWatchCount = (user.adWatchCount || 0) + 1;
          user.totalAdWatchCount = (user.totalAdWatchCount || 0) + 1;
          saveLocalCollection(LS_USERS, users);
          return { allowed: true };
      }
      return { allowed: false };
    }
  };
  
  // --- TASKS ---
  
  export const addTask = async (task: Task) => {
      try {
          // @ts-ignore
          await setDoc(doc(db, "tasks", task.id), { 
              ...task, 
              createdAt: Date.now(),
              completedCount: 0,
              isActive: true 
          });
      } catch {
          const tasks = getLocalCollection<Task>(LS_TASKS);
          tasks[task.id] = { ...task, createdAt: Date.now(), completedCount: 0, isActive: true };
          saveLocalCollection(LS_TASKS, tasks);
      }
  };
  
  export const deleteTask = async (id: string) => {
      try {
          // @ts-ignore
          await withTimeout(deleteDoc(doc(db, "tasks", id)));
      } catch {
          const tasks = getLocalCollection<Task>(LS_TASKS);
          delete tasks[id];
          saveLocalCollection(LS_TASKS, tasks);
      }
  };
  
  export const toggleTaskStatus = async (id: string, status: boolean) => {
      try {
          // @ts-ignore
          await updateDoc(doc(db, "tasks", id), { isActive: status });
      } catch {
          const tasks = getLocalCollection<Task>(LS_TASKS);
          if (tasks[id]) {
              tasks[id].isActive = status;
              saveLocalCollection(LS_TASKS, tasks);
          }
      }
  };
  
  export const getTasks = async () => {
      try {
          // @ts-ignore
          const q = query(collection(db, "tasks")); // Sorting done client side to avoid index error
          const snap = await withTimeout(getDocs(q)) as QuerySnapshot;
          return snap.docs.map(d => d.data() as Task).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      } catch { 
          const tasks = getLocalCollection<Task>(LS_TASKS);
          return Object.values(tasks).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      }
  };
  
  export const claimTask = async (userId: string, task: Task) => {
      const today = new Date().toISOString().split('T')[0];
      try {
          // @ts-ignore
          const userSnap = await getDoc(doc(db, "users", userId));
          if (!userSnap.exists()) return { success: false };
          const userData = userSnap.data() as User;
          
          if (userData.completedTasks?.includes(task.id)) return { success: false };
  
          // @ts-ignore
          const batch = writeBatch(db);
          
          // Update User
          // @ts-ignore
          batch.update(doc(db, "users", userId), {
              balance: increment(task.reward),
              lifetimeEarnings: increment(task.reward),
              completedTasks: arrayUnion(task.id),
              [`earningsHistory.${today}`]: increment(task.reward)
          });
  
          // Update Task Count
          // @ts-ignore
          batch.update(doc(db, "tasks", task.id), {
              completedCount: increment(1)
          });
  
          await batch.commit();
  
          // Check for auto-expire (Client side check for next render, or cloud function ideally)
          // We can do a quick check here if needed but simpler to leave open
          
          return { success: true, newBalance: userData.balance + task.reward };
      } catch {
          // Local fallback
          const users = getLocalCollection<User>(LS_USERS);
          const tasks = getLocalCollection<Task>(LS_TASKS);
          const user = users[userId];
          
          if (user && !user.completedTasks?.includes(task.id)) {
              user.balance += task.reward;
              user.lifetimeEarnings = (user.lifetimeEarnings || 0) + task.reward;
              user.completedTasks = [...(user.completedTasks || []), task.id];
              user.earningsHistory = user.earningsHistory || {};
              user.earningsHistory[today] = (user.earningsHistory[today] || 0) + task.reward;
  
              if (tasks[task.id]) {
                  tasks[task.id].completedCount = (tasks[task.id].completedCount || 0) + 1;
                  if (tasks[task.id].maxUsers && tasks[task.id].maxUsers > 0 && tasks[task.id].completedCount >= tasks[task.id].maxUsers) {
                      tasks[task.id].isActive = false;
                  }
              }
              saveLocalCollection(LS_USERS, users);
              saveLocalCollection(LS_TASKS, tasks);
              return { success: true, newBalance: user.balance };
          }
          return { success: false };
      }
  };
  
  // --- LEADERBOARD & ADMIN ---
  
  export const getLeaderboard = async () => {
      try {
          // Avoiding 'orderBy' in query to prevent "Missing Index" error. Sorting client side.
          // @ts-ignore
          const q = query(collection(db, "users"), limit(100));
          const snap = await withTimeout(getDocs(q)) as QuerySnapshot;
          const users = snap.docs.map(d => d.data() as User);
          return users.sort((a,b) => b.balance - a.balance).map((u, idx) => ({ 
              id: u.id, username: u.username, photoUrl: u.photoUrl, balance: u.balance, rank: idx + 1 
          }));
      } catch {
          const users = Object.values(getLocalCollection<User>(LS_USERS));
          return users.sort((a,b) => b.balance - a.balance).slice(0, 100).map((u, idx) => ({
              id: u.id, username: u.username, photoUrl: u.photoUrl, balance: u.balance, rank: idx + 1
          }));
      }
  };
  
  export const getReferredUsers = async (userId: string) => {
      try {
          // @ts-ignore
          const q = query(collection(db, "users"), where("referredBy", "==", userId));
          const snap = await withTimeout(getDocs(q)) as QuerySnapshot;
          return snap.docs.map(d => d.data() as User);
      } catch {
          const users = Object.values(getLocalCollection<User>(LS_USERS));
          return users.filter(u => u.referredBy === userId);
      }
  };
  
  export const getAllUsers = async (limitCount = 100) => {
      try {
          // No orderBy to ensure it works without index
          // @ts-ignore
          const q = query(collection(db, "users"), limit(limitCount));
          const snap = await withTimeout(getDocs(q)) as QuerySnapshot;
          const users = snap.docs.map(d => d.data() as User);
          return users.sort((a,b) => b.balance - a.balance);
      } catch {
          const users = Object.values(getLocalCollection<User>(LS_USERS));
          return users.sort((a,b) => b.balance - a.balance).slice(0, limitCount);
      }
  };
  
  export const searchUsers = async (term: string) => {
      try {
          // @ts-ignore
          const snap = await getDoc(doc(db, "users", term));
          if (snap.exists()) return [snap.data() as User];
          
          // Username search requires full scan or index, simplifying to just ID fetch for safety or client filter
          // For simplicity in this robust version, we do client side filter of 'getAllUsers' (not ideal for huge DB but works for now)
          const all = await getAllUsers(200);
          return all.filter(u => u.username.toLowerCase().includes(term.toLowerCase()));
      } catch {
          const users = Object.values(getLocalCollection<User>(LS_USERS));
          return users.filter(u => u.id === term || u.username.includes(term));
      }
  };
  
  export const adminUpdateUser = async (userId: string, data: Partial<User>) => {
      try {
          // @ts-ignore
          await updateDoc(doc(db, "users", userId), data);
      } catch {
          const users = getLocalCollection<User>(LS_USERS);
          if (users[userId]) {
              users[userId] = { ...users[userId], ...data };
              saveLocalCollection(LS_USERS, users);
          }
      }
  };
  
  export const getTotalUserCount = async () => {
      try {
           // @ts-ignore
           const snap = await getCountFromServer(collection(db, "users"));
           return snap.data().count;
      } catch {
           // Fallback estimation
           const all = await getAllUsers(500); 
           return all.length;
      }
  };
  
  export const getAppConfig = async (): Promise<AppConfig> => {
      const d: AppConfig = { adReward:150, referralBonus:1000, referralBonusPremium:5000, maintenanceMode:false, telegramChannelUrl:"", miniAppUrl:"", gigaPubId:"4473", dailyAdLimit:100 };
      try {
          // @ts-ignore
          const snap = await withTimeout(getDoc(doc(db, "settings", "globalConfig"))) as DocumentSnapshot;
          return snap.exists() ? { ...d, ...snap.data() } : d;
      } catch {
          const local = getLocalCollection<AppConfig>(LS_CONFIG);
          return local['globalConfig'] ? { ...d, ...local['globalConfig'] } : d;
      }
  };
  
  export const updateAppConfig = async (config: AppConfig) => {
      try {
          // @ts-ignore
          await setDoc(doc(db, "settings", "globalConfig"), config);
      } catch {
          const cfg = getLocalCollection<AppConfig>(LS_CONFIG);
          cfg['globalConfig'] = config;
          saveLocalCollection(LS_CONFIG, cfg);
      }
  };
  
  // --- PROMOS ---
  export const createPromoCode = async (promo: PromoCode) => { 
      try {
          // @ts-ignore
          await setDoc(doc(db, "promos", promo.code), promo);
      } catch {
          const promos = getLocalCollection<PromoCode>(LS_PROMOS);
          promos[promo.code] = promo;
          saveLocalCollection(LS_PROMOS, promos);
      }
  };
  
  export const getPromoCodes = async () => { 
      try {
          // @ts-ignore
          const snap = await withTimeout(getDocs(collection(db, "promos"))) as QuerySnapshot;
          return snap.docs.map(d => d.data() as PromoCode);
      } catch {
          return Object.values(getLocalCollection<PromoCode>(LS_PROMOS));
      }
  };
  
  export const deletePromoCode = async (code: string) => { 
      try {
          // @ts-ignore
          await deleteDoc(doc(db, "promos", code));
      } catch {
          const promos = getLocalCollection<PromoCode>(LS_PROMOS);
          delete promos[code];
          saveLocalCollection(LS_PROMOS, promos);
      }
  };
  
  export const redeemPromoCode = async (userId: string, code: string): Promise<{success: boolean, message: string}> => {
    const today = new Date().toISOString().split('T')[0];
    try {
        // @ts-ignore
        const promoSnap = await getDoc(doc(db, "promos", code));
        if (!promoSnap.exists()) return { success: false, message: "Invalid Code" };
        const promo = promoSnap.data() as PromoCode;
        
        if (!promo.isActive) return { success: false, message: "Code Inactive" };
        if (promo.maxUsers > 0 && promo.usedCount >= promo.maxUsers) return { success: false, message: "Limit Reached" };
  
        // @ts-ignore
        const userSnap = await getDoc(doc(db, "users", userId));
        const user = userSnap.data() as User;
        if (user.redeemedCodes?.includes(code)) return { success: false, message: "Already Claimed" };
  
        // @ts-ignore
        const batch = writeBatch(db);
        // @ts-ignore
        batch.update(doc(db, "users", userId), {
            balance: increment(promo.reward),
            lifetimeEarnings: increment(promo.reward),
            [`earningsHistory.${today}`]: increment(promo.reward),
            redeemedCodes: arrayUnion(code)
        });
        // @ts-ignore
        batch.update(doc(db, "promos", code), { usedCount: increment(1) });
        
        await batch.commit();
        return { success: true, message: `+${promo.reward} Points!` };
  
    } catch {
        // Local fallback logic
        const users = getLocalCollection<User>(LS_USERS);
        const promos = getLocalCollection<PromoCode>(LS_PROMOS);
        const user = users[userId];
        const promo = promos[code];
  
        if (!promo) return { success: false, message: "Invalid Code" };
        if (user.redeemedCodes?.includes(code)) return { success: false, message: "Already Claimed" };
        
        user.balance += promo.reward;
        user.lifetimeEarnings = (user.lifetimeEarnings || 0) + promo.reward;
        user.redeemedCodes = [...(user.redeemedCodes || []), code];
        user.earningsHistory = user.earningsHistory || {};
        user.earningsHistory[today] = (user.earningsHistory[today] || 0) + promo.reward;
        
        promo.usedCount++;
        saveLocalCollection(LS_USERS, users);
        saveLocalCollection(LS_PROMOS, promos);
        return { success: true, message: `+${promo.reward} Points!` };
    }
  };
