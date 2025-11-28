
import { User } from '../types';

// Mock type for the global Telegram object
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          start_param?: string;
        };
        MainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
        showAlert: (message: string, callback?: () => void) => void;
        version: string;
        themeParams: any;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;

export const initTelegram = () => {
  if (tg) {
    tg.ready();
    tg.expand();
  }
};

/**
 * Robust function to get Telegram User.
 * Tries standard WebApp API first.
 * If that fails (common on PC/Desktop), tries to parse window.location.hash.
 * Falls back to LocalStorage for browser testing only.
 */
export const getTelegramUser = (): User | null => {
  // 1. Try Standard API
  if (tg?.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    return {
      id: u.id.toString(),
      username: u.username || `User${u.id}`,
      firstName: u.first_name,
      lastName: u.last_name,
      photoUrl: u.photo_url,
      isPremium: u.is_premium || false,
      balance: 0,
      referralCode: u.id.toString(),
      referredBy: tg.initDataUnsafe.start_param,
      completedTasks: []
    };
  }

  // 2. Try Parsing URL Hash (PC Fallback)
  try {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const tgWebAppData = params.get('tgWebAppData');
    
    if (tgWebAppData) {
      const dataParams = new URLSearchParams(decodeURIComponent(tgWebAppData));
      const userJson = dataParams.get('user');
      if (userJson) {
        const u = JSON.parse(userJson);
        const startParam = dataParams.get('start_param');
        return {
          id: u.id.toString(),
          username: u.username || `User${u.id}`,
          firstName: u.first_name,
          lastName: u.last_name,
          photoUrl: u.photo_url,
          isPremium: u.is_premium || false,
          balance: 0,
          referralCode: u.id.toString(),
          referredBy: startParam || undefined,
          completedTasks: []
        };
      }
    }
  } catch (e) {
    console.error("Error parsing Telegram Hash:", e);
  }
  
  // 3. Browser Fallback (Testing Only)
  // Check if we are inside Telegram (if initData is empty string, usually means we are not)
  if (tg && tg.initData === "") {
      const STORAGE_KEY = 'debug_telegram_user_id';
      let debugUserId = localStorage.getItem(STORAGE_KEY);
      
      if (!debugUserId) {
        debugUserId = Math.floor(100000000 + Math.random() * 900000000).toString();
        localStorage.setItem(STORAGE_KEY, debugUserId);
      }

      return {
        id: debugUserId,
        username: `tester_${debugUserId.substring(0, 5)}`,
        firstName: "Test",
        lastName: "User",
        photoUrl: "https://picsum.photos/200",
        isPremium: false,
        balance: 0,
        referralCode: debugUserId,
        completedTasks: []
      };
  }

  return null;
};

export const hapticFeedback = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred(style);
  }
};

export const notificationFeedback = (type: 'error' | 'success' | 'warning') => {
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred(type);
  }
};

const isVersionAtLeast = (minVersion: string) => {
  if (!tg?.version) return false;
  const v1 = tg.version.split('.').map(Number);
  const v2 = minVersion.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const n1 = v1[i] || 0;
    const n2 = v2[i] || 0;
    if (n1 > n2) return true;
    if (n1 < n2) return false;
  }
  return true;
};

export const safeAlert = (message: string) => {
  if (tg?.showAlert && isVersionAtLeast('6.2')) {
    tg.showAlert(message);
  } else {
    alert(message);
  }
};

export const openLink = (url: string) => {
  if (tg) {
    if (url.includes('t.me')) {
        tg.openTelegramLink(url);
    } else {
        tg.openLink(url);
    }
  } else {
    window.open(url, '_blank');
  }
};

export const checkChannelMembership = async (botToken: string, chatId: string, userId: string): Promise<boolean> => {
  try {
    if (!botToken || !chatId || !userId) return false;
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const data = await response.json();

    if (!data.ok) {
      console.warn("Telegram API Error:", data.description);
      return false;
    }

    const status = data.result?.status;
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    return validStatuses.includes(status);
  } catch (error) {
    console.error("Membership check failed", error);
    return false;
  }
};
