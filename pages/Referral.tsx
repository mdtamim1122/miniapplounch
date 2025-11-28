
import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { hapticFeedback, notificationFeedback } from '../services/telegramService';
import { useTheme } from '../contexts/ThemeContext';
import { getAppConfig } from '../services/dbService';

interface ReferralProps {
  user: User;
}

const Referral: React.FC<ReferralProps> = ({ user }) => {
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [loadingLink, setLoadingLink] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const { theme } = useTheme();

  // Load Config to get the Mini App URL dynamically
  useEffect(() => {
    const loadConfig = async () => {
      const cfg = await getAppConfig();
      setConfig(cfg);
      // Generate Direct Start App Link: t.me/bot/app?startapp=CODE
      // Ensure the URL doesn't already have params and handle trailing slashes
      const baseUrl = cfg.miniAppUrl || "https://t.me/GeminiGoldRushBot/app";
      const separator = baseUrl.includes('?') ? '&' : '?';
      const link = `${baseUrl}${separator}startapp=${user.referralCode}`;
      setInviteLink(link);
      setLoadingLink(false);
    };
    loadConfig();
  }, [user.referralCode]);

  const handleCopy = () => {
    if (loadingLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    notificationFeedback('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (loadingLink) return;
    hapticFeedback('medium');
    const text = `Join me on Gemini Gold Rush and earn coins! 🚀`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink(url);
  };

  return (
    <div className="flex flex-col h-screen pt-8 pb-24 px-6 animate-fade-in items-center transition-colors duration-500">
      
      {/* 3D Icon */}
      <div className="w-32 h-32 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-[35px] flex items-center justify-center mb-6 shadow-2xl shadow-green-500/30 rotate-12 animate-float">
        <svg className="w-16 h-16 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      </div>

      <h2 className="text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white font-display">Invite Friends</h2>
      
      <div className="w-full grid grid-cols-2 gap-3 mb-6">
        <div className="glass-panel bg-blue-50/50 dark:bg-white/5 rounded-2xl p-4 text-center border border-blue-100 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Normal User</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">+{config?.referralBonus || 1000}</p>
        </div>
        <div className="glass-panel bg-yellow-50/50 dark:bg-yellow-500/10 rounded-2xl p-4 text-center border border-yellow-200 dark:border-yellow-500/20">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase font-bold">Premium User</p>
          <p className="text-xl font-black text-yellow-600 dark:text-yellow-400 mt-1">+{config?.referralBonusPremium || 5000}</p>
        </div>
      </div>

      {/* Stats - Split Card */}
      <div className="w-full grid grid-cols-2 gap-4 mb-4">
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 rounded-[24px] p-5 flex flex-col items-center border border-ios-border dark:border-white/5 shadow-ios-light dark:shadow-none">
          <span className="text-3xl font-black text-gray-900 dark:text-white">0</span>
          <span className="text-xs font-bold text-ios-subtext uppercase tracking-wider mt-1">Friends</span>
        </div>
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 rounded-[24px] p-5 flex flex-col items-center border border-ios-border dark:border-white/5 shadow-ios-light dark:shadow-none">
          <span className="text-3xl font-black text-ios-primary dark:text-ios-gold">0</span>
          <span className="text-xs font-bold text-ios-subtext uppercase tracking-wider mt-1">Earned</span>
        </div>
      </div>

      {/* Referral Link Display Box (New Addition) */}
      <div className="w-full glass-panel bg-white dark:bg-white/5 border-2 border-dashed border-gray-300 dark:border-white/20 p-4 rounded-xl mb-4 text-center relative overflow-hidden group">
         <div className="absolute inset-0 bg-gray-50 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-1 relative z-10">Your Invite Link</p>
         <p className="font-mono text-sm font-bold text-gray-900 dark:text-white break-all select-all relative z-10">
           {loadingLink ? "Generating Link..." : inviteLink}
         </p>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3 mt-auto mb-8">
        <button 
          onClick={handleShare}
          disabled={loadingLink}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-lg py-4 rounded-[20px] shadow-lg active:scale-95 transition-transform flex items-center justify-center disabled:opacity-50"
        >
          {loadingLink ? 'Loading...' : 'Invite Friends'}
        </button>
        
        <button 
          onClick={handleCopy}
          disabled={loadingLink}
          className="w-full bg-white dark:bg-ios-dark-card border border-ios-border dark:border-white/10 text-gray-900 dark:text-white font-bold py-4 rounded-[20px] active:scale-95 transition-transform flex items-center justify-center relative overflow-hidden shadow-sm disabled:opacity-50"
        >
          {copied ? (
             <span className="flex items-center text-green-500 dark:text-green-400 animate-fade-in">
               <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
               Link Copied!
             </span>
          ) : (
            <span>Copy Link</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Referral;
