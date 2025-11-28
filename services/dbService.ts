
import { User, LeaderboardEntry, AppConfig, Task, PromoCode } from '../types';

// --- MONGODB CONFIGURATION ---
// TODO: Replace these with your actual MongoDB Atlas Data API credentials
// Go to "App Services" tab in Atlas -> Create App -> Data API (Left Menu) -> Enable & Create Key
const MONGO_API_URL = "https://data.mongodb-api.com/app/data-xxxxx/endpoint/data/v1";
const MONGO_API_KEY = "YOUR_MONGODB_API_KEY"; 
const CLUSTER_NAME = "Cluster0";
const DB_NAME = "telegram-mini-app";

// Collections
const USERS_COL = "users";
const TASKS_COL = "tasks";
const PROMOS_COL = "promos";
const CONFIG_COL = "settings";

// Local Storage Keys
const LS_USERS = 'offline_users';
const LS_TASKS = 'offline_tasks';
const LS_PROMOS = 'offline_promos';
const LS_CONFIG = 'offline_config';

// Helper to check if we are in offline/local mode
const isLocalMode = () => {
    return MONGO_API_KEY === "YOUR_MONGODB_API_KEY" || MONGO_API_KEY === "";
};

// --- LOCAL DB HELPERS ---
const getLocalCollection = <T>(key: string): Record<string, T> => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};
const saveLocalCollection = <T>(key: string, data: Record<string, T>) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};
const updateLocalDoc = <T>(key: string, id: string, data: Partial<T>) => {
    const col = getLocalCollection<T>(key);
    // @ts-ignore
    col[id] = { ...col[id], ...data };
    saveLocalCollection(key, col);
};

// --- MONGODB API CALL ---
const mongoRequest = async (action: string, collection: string, body: any = {}) => {
  try {
    if (isLocalMode()) throw new Error("Local Mode");

    const response = await fetch(`${MONGO_API_URL}/action/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Request-Headers': '*',
        'api-key': MONGO_API_KEY,
      },
      body: JSON.stringify({
        collection: collection,
        database: DB_NAME,
        dataSource: CLUSTER_NAME,
        ...body
      })
    });
    
    if (!response.ok) throw new Error(`Mongo Error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    throw error; // Propagate to fallback
  }
};

// --- USER FUNCTIONS ---

export const getUserData = async (userId: string): Promise<User | null> => {
  try {
    const res = await mongoRequest('findOne', USERS_COL, { filter: { _id: userId } });
    if (res.document) return res.document as User;
    return null;
  } catch (error) {
    const users = getLocalCollection<User>(LS_USERS);
    return users[userId] || null;
  }
};

export const createUser = async (user: User): Promise<User> => {
  const newUser: User = { 
      ...user, 
      // @ts-ignore
      _id: user.id, 
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

    // Referral Logic
    if (user.referredBy && user.referredBy !== user.id) {
        const bonus = user.isPremium ? (config.referralBonusPremium || 5000) : config.referralBonus;
        newUser.earnedFromReferrer = bonus;

        const today = new Date().toISOString().split('T')[0];
        
        // Update Referrer (Try Mongo)
        if (!isLocalMode()) {
            await mongoRequest('updateOne', USERS_COL, {
                filter: { _id: user.referredBy },
                update: {
                    $inc: { 
                        balance: bonus,
                        referralCount: 1,
                        totalReferralRewards: bonus,
                        lifetimeEarnings: bonus,
                        [`earningsHistory.${today}`]: bonus
                    }
                }
            });
        } else {
            // Update Referrer (Local)
            const users = getLocalCollection<User>(LS_USERS);
            const refUser = users[user.referredBy];
            if (refUser) {
                refUser.balance += bonus;
                refUser.referralCount = (refUser.referralCount || 0) + 1;
                refUser.totalReferralRewards = (refUser.totalReferralRewards || 0) + bonus;
                refUser.lifetimeEarnings = (refUser.lifetimeEarnings || 0) + bonus;
                refUser.earningsHistory = refUser.earningsHistory || {};
                refUser.earningsHistory[today] = (refUser.earningsHistory[today] || 0) + bonus;
                saveLocalCollection(LS_USERS, users);
            }
        }
    }

    if (!isLocalMode()) {
        await mongoRequest('insertOne', USERS_COL, { document: newUser });
    } else {
        const users = getLocalCollection<User>(LS_USERS);
        users[newUser.id] = newUser;
        saveLocalCollection(LS_USERS, users);
    }
    return newUser;

  } catch (error) {
    // Final Safety Net
    const users = getLocalCollection<User>(LS_USERS);
    users[user.id] = newUser;
    saveLocalCollection(LS_USERS, users);
    return newUser;
  }
};

export const updateUserBalance = async (userId: string, amount: number): Promise<number> => {
  const today = new Date().toISOString().split('T')[0];
  try {
    if (isLocalMode()) throw new Error("Local");
    await mongoRequest('updateOne', USERS_COL, {
        filter: { _id: userId },
        update: {
            $inc: {
                balance: amount,
                lifetimeEarnings: amount,
                [`earningsHistory.${today}`]: amount
            }
        }
    });
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
  const limit = config.dailyAdLimit || 20;
  const today = new Date().toISOString().split('T')[0];

  const doCheck = (user: User) => {
    if (user.lastAdWatchDate !== today) {
        user.adWatchCount = 1;
        user.lastAdWatchDate = today;
        user.totalAdWatchCount = (user.totalAdWatchCount || 0) + 1;
        return true;
    }
    if ((user.adWatchCount || 0) >= limit) return false;
    user.adWatchCount = (user.adWatchCount || 0) + 1;
    user.totalAdWatchCount = (user.totalAdWatchCount || 0) + 1;
    return true;
  }

  try {
    if (isLocalMode()) throw new Error("Local");
    const user = await getUserData(userId);
    if(!user) return {allowed:false};
    
    // DB Logic is handled by update operators usually, but for complex logic we read-modify-write or strict ops
    // Here we simplified for fallback consistency
    if(user.lastAdWatchDate !== today) {
         await mongoRequest('updateOne', USERS_COL, {
            filter: { _id: userId },
            update: { $set: { adWatchCount: 1, lastAdWatchDate: today }, $inc: { totalAdWatchCount: 1 } }
        });
        return { allowed: true };
    }
    if ((user.adWatchCount || 0) >= limit) return { allowed: false, message: `Limit ${limit}/${limit}` };
    
    await mongoRequest('updateOne', USERS_COL, {
        filter: { _id: userId },
        update: { $inc: { adWatchCount: 1, totalAdWatchCount: 1 } }
    });
    return { allowed: true };
  } catch (e) {
    const users = getLocalCollection<User>(LS_USERS);
    if (users[userId]) {
        const allowed = doCheck(users[userId]);
        saveLocalCollection(LS_USERS, users);
        if (!allowed) return { allowed: false, message: `Limit ${limit}/${limit}` };
        return { allowed: true };
    }
    return { allowed: false };
  }
};

// --- TASKS ---
export const addTask = async (t: Task) => {
    const task = { ...t, _id: t.id, createdAt: Date.now(), completedCount: 0, isActive: true };
    try {
        if (isLocalMode()) throw new Error("Local");
        // @ts-ignore
        await mongoRequest('insertOne', TASKS_COL, { document: task });
    } catch {
        const tasks = getLocalCollection<Task>(LS_TASKS);
        tasks[task.id] = task;
        saveLocalCollection(LS_TASKS, tasks);
    }
};

export const deleteTask = async (id: string) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        await mongoRequest('deleteOne', TASKS_COL, { filter: { _id: id } });
    } catch {
        const tasks = getLocalCollection<Task>(LS_TASKS);
        delete tasks[id];
        saveLocalCollection(LS_TASKS, tasks);
    }
};

export const toggleTaskStatus = async (id: string, s: boolean) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        await mongoRequest('updateOne', TASKS_COL, { filter: { _id: id }, update: { $set: { isActive: s } } });
    } catch {
        const tasks = getLocalCollection<Task>(LS_TASKS);
        if(tasks[id]) {
            tasks[id].isActive = s;
            saveLocalCollection(LS_TASKS, tasks);
        }
    }
};

export const getTasks = async () => {
    try {
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('find', TASKS_COL, { sort: { createdAt: -1 } });
        return res.documents as Task[];
    } catch { 
        const tasks = getLocalCollection<Task>(LS_TASKS);
        return Object.values(tasks).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    }
};

export const claimTask = async (uid: string, t: Task) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        if (isLocalMode()) throw new Error("Local");
        // ... (Server logic omitted for brevity, fallback handles it)
        const user = await getUserData(uid);
        if (!user || user.completedTasks?.includes(t.id)) return {success:false};
        
        await mongoRequest('updateOne', USERS_COL, {
            filter: { _id: uid },
            update: {
                $inc: { 
                    balance: t.reward,
                    lifetimeEarnings: t.reward,
                    [`earningsHistory.${today}`]: t.reward
                },
                $push: { completedTasks: t.id }
            }
        });
        await mongoRequest('updateOne', TASKS_COL, {
            filter: { _id: t.id },
            update: { $inc: { completedCount: 1 } }
        });
        return { success: true, newBalance: user.balance + t.reward };
    } catch {
        const users = getLocalCollection<User>(LS_USERS);
        const tasks = getLocalCollection<Task>(LS_TASKS);
        
        const user = users[uid];
        const task = tasks[t.id] || t; // Use passed task if not in local DB (e.g. from default list)
        
        if (user && !user.completedTasks?.includes(t.id)) {
            user.balance += t.reward;
            user.lifetimeEarnings = (user.lifetimeEarnings || 0) + t.reward;
            user.earningsHistory = user.earningsHistory || {};
            user.earningsHistory[today] = (user.earningsHistory[today] || 0) + t.reward;
            user.completedTasks = [...(user.completedTasks || []), t.id];
            
            if (tasks[t.id]) {
                tasks[t.id].completedCount = (tasks[t.id].completedCount || 0) + 1;
                // Auto expire check local
                if (tasks[t.id].maxUsers && tasks[t.id].maxUsers > 0 && tasks[t.id].completedCount >= tasks[t.id].maxUsers) {
                    tasks[t.id].isActive = false;
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
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('find', USERS_COL, { sort: { balance: -1 }, limit: 100 });
        const users = res.documents as User[];
        return users.map((u, idx) => ({ id: u.id, username: u.username, photoUrl: u.photoUrl, balance: u.balance, rank: idx + 1 }));
    } catch {
        const users = Object.values(getLocalCollection<User>(LS_USERS));
        return users.sort((a,b) => b.balance - a.balance).slice(0, 100).map((u, idx) => ({
            id: u.id, username: u.username, photoUrl: u.photoUrl, balance: u.balance, rank: idx + 1
        }));
    }
};

export const getReferredUsers = async (userId: string) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('find', USERS_COL, { filter: { referredBy: userId } });
        return res.documents as User[];
    } catch {
        const users = Object.values(getLocalCollection<User>(LS_USERS));
        return users.filter(u => u.referredBy === userId);
    }
};

export const getAllUsers = async (limitCount = 50) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('find', USERS_COL, { limit: limitCount, sort: { balance: -1 } });
        return res.documents as User[];
    } catch {
        const users = Object.values(getLocalCollection<User>(LS_USERS));
        return users.sort((a,b) => b.balance - a.balance).slice(0, limitCount);
    }
};

export const searchUsers = async (term: string) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        const resId = await mongoRequest('findOne', USERS_COL, { filter: { _id: term } });
        if (resId.document) return [resId.document as User];
        const resName = await mongoRequest('find', USERS_COL, { filter: { username: term } });
        return resName.documents as User[];
    } catch {
        const users = Object.values(getLocalCollection<User>(LS_USERS));
        return users.filter(u => u.id === term || u.username === term);
    }
};

export const adminUpdateUser = async (uid: string, d: Partial<User>) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        await mongoRequest('updateOne', USERS_COL, { filter: { _id: uid }, update: { $set: d } });
    } catch {
        updateLocalDoc(LS_USERS, uid, d);
    }
};

export const getTotalUserCount = async () => {
    try {
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('aggregate', USERS_COL, { pipeline: [ { $count: "count" } ] });
        return res.documents[0]?.count || 0;
    } catch {
        return Object.keys(getLocalCollection(LS_USERS)).length;
    }
};

export const getAppConfig = async (): Promise<AppConfig> => {
    const d: AppConfig = { adReward:150, referralBonus:1000, referralBonusPremium:5000, maintenanceMode:false, telegramChannelUrl:"", miniAppUrl:"", gigaPubId:"4473", dailyAdLimit:20 };
    try {
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('findOne', CONFIG_COL, { filter: { _id: "globalConfig" } });
        return res.document ? { ...d, ...res.document } : d;
    } catch {
        const local = getLocalCollection<AppConfig>(LS_CONFIG);
        return local['globalConfig'] ? { ...d, ...local['globalConfig'] } : d;
    }
};

export const updateAppConfig = async (c: AppConfig) => {
    try {
        if (isLocalMode()) throw new Error("Local");
        // @ts-ignore
        await mongoRequest('updateOne', CONFIG_COL, { filter: { _id: "globalConfig" }, update: { $set: c }, upsert: true });
    } catch {
        const cfg = getLocalCollection<AppConfig>(LS_CONFIG);
        cfg['globalConfig'] = c;
        saveLocalCollection(LS_CONFIG, cfg);
    }
};

// --- PROMOS ---
export const createPromoCode = async (promo: PromoCode) => { 
    try {
        if (isLocalMode()) throw new Error("Local");
        // @ts-ignore
        await mongoRequest('insertOne', PROMOS_COL, { document: { ...promo, _id: promo.code } });
    } catch {
        const promos = getLocalCollection<PromoCode>(LS_PROMOS);
        promos[promo.code] = promo;
        saveLocalCollection(LS_PROMOS, promos);
    }
};

export const getPromoCodes = async () => { 
    try {
        if (isLocalMode()) throw new Error("Local");
        const res = await mongoRequest('find', PROMOS_COL, { filter: {} });
        return res.documents as PromoCode[];
    } catch {
        return Object.values(getLocalCollection<PromoCode>(LS_PROMOS));
    }
};

export const deletePromoCode = async (code: string) => { 
    try {
        if (isLocalMode()) throw new Error("Local");
        await mongoRequest('deleteOne', PROMOS_COL, { filter: { _id: code } });
    } catch {
        const promos = getLocalCollection<PromoCode>(LS_PROMOS);
        delete promos[code];
        saveLocalCollection(LS_PROMOS, promos);
    }
};

export const redeemPromoCode = async (userId: string, code: string): Promise<{success: boolean, message: string}> => {
  const today = new Date().toISOString().split('T')[0];
  try {
      if (isLocalMode()) throw new Error("Local");
      // ... (Server logic fallback handles)
      const resCode = await mongoRequest('findOne', PROMOS_COL, { filter: { _id: code } });
      const promo = resCode.document as PromoCode;
      if (!promo) return { success: false, message: "Invalid Code" };
      if (!promo.isActive) return { success: false, message: "Code Inactive" };
      if (promo.maxUsers > 0 && promo.usedCount >= promo.maxUsers) return { success: false, message: "Limit Reached" };

      const user = await getUserData(userId);
      if (!user) return { success: false, message: "User error" };
      if (user.redeemedCodes?.includes(code)) return { success: false, message: "Already Claimed" };

      await mongoRequest('updateOne', USERS_COL, {
          filter: { _id: userId },
          update: {
              $inc: { balance: promo.reward, lifetimeEarnings: promo.reward, [`earningsHistory.${today}`]: promo.reward },
              $push: { redeemedCodes: code }
          }
      });
      await mongoRequest('updateOne', PROMOS_COL, { filter: { _id: code }, update: { $inc: { usedCount: 1 } } });
      return { success: true, message: `+${promo.reward} Points!` };
  } catch (e) {
      // Local Fallback
      const users = getLocalCollection<User>(LS_USERS);
      const promos = getLocalCollection<PromoCode>(LS_PROMOS);
      const user = users[userId];
      const promo = promos[code];
      
      if (!promo) return { success: false, message: "Invalid Code (Local)" };
      if (!promo.isActive) return { success: false, message: "Code Inactive" };
      if (promo.maxUsers > 0 && promo.usedCount >= promo.maxUsers) return { success: false, message: "Limit Reached" };
      if (!user) return { success: false, message: "User error" };
      if (user.redeemedCodes?.includes(code)) return { success: false, message: "Already Claimed" };

      user.balance += promo.reward;
      user.lifetimeEarnings = (user.lifetimeEarnings || 0) + promo.reward;
      user.earningsHistory = user.earningsHistory || {};
      user.earningsHistory[today] = (user.earningsHistory[today] || 0) + promo.reward;
      user.redeemedCodes = [...(user.redeemedCodes || []), code];
      
      promo.usedCount++;
      
      saveLocalCollection(LS_USERS, users);
      saveLocalCollection(LS_PROMOS, promos);
      return { success: true, message: `+${promo.reward} Points! (Local)` };
  }
};
