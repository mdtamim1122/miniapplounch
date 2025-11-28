
export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  isPremium?: boolean; // Telegram Premium Flag
  balance: number;
  referralCode: string;
  referredBy?: string;
  referralCount?: number; // Optimized field to store total invites
  totalReferralRewards?: number; // Total points earned specifically from referrals
  earnedFromReferrer?: number; // How much bonus this user generated for their parent
  completedTasks?: string[]; // Array of Task IDs that user has finished
  
  // Ad Tracking
  adWatchCount?: number; // Daily count
  totalAdWatchCount?: number; // Lifetime count
  lastAdWatchDate?: string; // YYYY-MM-DD
  
  // Stats & History
  lifetimeEarnings?: number;
  earningsHistory?: Record<string, number>; // { "2024-11-28": 500, ... }
  redeemedCodes?: string[]; // List of promo codes used
}

export type TaskType = 'web' | 'telegram';

export interface Task {
  id: string;
  title: string;
  reward: number;
  type: TaskType;
  url: string; // The link to visit or channel to join
  chatId?: string; // The Username (@channel) or ID (-100...) for API check
  createdAt?: number;
  
  // Limits
  maxUsers?: number; // 0 or undefined means infinite
  completedCount?: number;
  isActive?: boolean; // To manually or automatically hide tasks
}

export interface PromoCode {
  code: string; // The actual code (e.g. "WELCOME100")
  reward: number;
  maxUsers: number;
  usedCount: number;
  isActive: boolean;
  createdAt: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  photoUrl?: string;
  balance: number;
  rank: number;
}

export interface AppConfig {
  adReward: number;
  referralBonus: number; // Normal User Bonus
  referralBonusPremium: number; // Premium User Bonus
  maintenanceMode: boolean;
  maintenanceEndTime?: string; // ISO String for when maintenance ends
  telegramChannelUrl: string;
  botToken?: string; // Token for API calls
  miniAppUrl: string; // The direct link to the mini app (e.g. t.me/bot/app)
  
  // Ads
  gigaPubId?: string; // Dynamic Script ID
  dailyAdLimit?: number; // Max ads per user per day
}

declare global {
  interface Window {
    showGiga: () => Promise<void>;
  }
}
