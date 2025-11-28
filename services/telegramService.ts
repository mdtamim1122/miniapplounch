
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
            is_premium?: boolean; // Telegram Premium Flag
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

export const getTelegramUser = (): User | null => {
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

/**
 * Verifies if a user is a member of a channel using Telegram Bot API
 * Note: The Bot used for the token MUST be an administrator in the channel.
 */
export const checkChannelMembership = async (botToken: string, chatId: string, userId: string): Promise<boolean> => {
  try {
    // Basic validation
    if (!botToken || !chatId || !userId) return false;

    // Call Telegram API
    // We use a fetch call here. In a high-security app, this should be proxied via backend to hide the token.
    // For this mini-app setup, we call directly.
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const data = await response.json();

    if (!data.ok) {
      console.warn("Telegram API Error:", data.description);
      return false;
    }

    const status = data.result?.status;
    // Valid statuses that imply membership
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    
    // 'restricted' usually means they are in the group but restricted from posting (still a member)
    // 'left' or 'kicked' means they are not a member
    
    return validStatuses.includes(status);

  } catch (error) {
    console.error("Membership check failed", error);
    return false;
  }
};
