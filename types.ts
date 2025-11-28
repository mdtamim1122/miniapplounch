export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
}

export interface Task {
  id: string;
  title: string;
  reward: number;
  icon: string; // Emoji or SVG path
  type: 'ad' | 'social';
  completed: boolean;
  cooldown?: number; // in seconds
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
  referralBonus: number;
  maintenanceMode: boolean;
  telegramChannelUrl: string;
}

declare global {
  interface Window {
    showGiga: () => Promise<void>;
  }
}