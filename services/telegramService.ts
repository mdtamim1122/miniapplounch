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
  // 1. Try to get real Telegram User
  if (tg?.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    return {
      id: u.id.toString(),
      username: u.username || `User${u.id}`,
      firstName: u.first_name,
      lastName: u.last_name,
      photoUrl: u.photo_url,
      balance: 0, // Initial balance, will be overwritten by DB
      referralCode: u.id.toString(), // Simple referral code
      referredBy: tg.initDataUnsafe.start_param,
    };
  }
  
  // 2. Fallback for Browser Testing (Real Data Capture)
  // Instead of a static "Demo User", we generate a random ID and store it in localStorage
  // so you can test "new user" vs "returning user" flows in the browser without Telegram.
  const STORAGE_KEY = 'debug_telegram_user_id';
  let debugUserId = localStorage.getItem(STORAGE_KEY);
  
  if (!debugUserId) {
    // Generate a random 9-digit ID to simulate a Telegram ID
    debugUserId = Math.floor(100000000 + Math.random() * 900000000).toString();
    localStorage.setItem(STORAGE_KEY, debugUserId);
  }

  // Return a consistent "Real" user for this browser session
  return {
    id: debugUserId,
    username: `tester_${debugUserId.substring(0, 5)}`,
    firstName: "Test",
    lastName: "User",
    photoUrl: "https://picsum.photos/200", // Random avatar
    balance: 0,
    referralCode: debugUserId,
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

// Version helper to handle "6.0" vs "6.2" logic
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

// Safe alert that falls back to browser alert if WebApp method is unsupported (older than 6.2)
export const safeAlert = (message: string) => {
  // showAlert was introduced in Bot API 6.2
  if (tg?.showAlert && isVersionAtLeast('6.2')) {
    tg.showAlert(message);
  } else {
    // Fallback for version 6.0/6.1 or web browsers
    alert(message);
  }
};