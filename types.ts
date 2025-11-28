
export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
  completedTasks?: string[]; // Array of Task IDs that user has finished
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
  botToken?: string; // Token for API calls
  miniAppUrl: string; // The direct link to the mini app (e.g. t.me/bot/app)
}

declare global {
  interface Window {
    showGiga: () => Promise<void>;
  }
}