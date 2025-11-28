
import React, { useState, useEffect } from 'react';
import { User } from '../types';
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
  const { theme } = useTheme();

  // Load Config to get the Mini App URL dynamically
  useEffect(() => {
    const loadConfig = async () => {
      const config = await getAppConfig();
      // Generate Direct Start App Link: t.me/bot/app?startapp=CODE
      // Ensure the URL doesn't already have params and handle trailing slashes
      const baseUrl = config.miniAppUrl || "https://t.me/GeminiGoldRushBot/app";
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
      <p className="text-center text-gray-500 dark:text-ios-subtext text-base mb-8 max-w-[280px] leading-relaxed">
        Earn <span className="text-green-500 dark:text-green-400 font-bold">1,000 GP</span> for every friend who joins using your link.
      </p>

      {/* Stats - Split Card */}
      <div className="w-full grid grid-cols-2 gap-4 mb-8">
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 rounded-[24px] p-5 flex flex-col items-center border border-ios-border dark:border-white/5 shadow-ios-light dark:shadow-none">
          <span className="text-3xl font-black text-gray-900 dark:text-white">0</span>
          <span className="text-xs font-bold text-ios-subtext uppercase tracking-wider mt-1">Friends</span>
        </div>
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 rounded-[24px] p-5 flex flex-col items-center border border-ios-border dark:border-white/5 shadow-ios-light dark:shadow-none">
          <span className="text-3xl font-black text-ios-primary dark:text-ios-gold">0</span>
          <span className="text-xs font-bold text-ios-subtext uppercase tracking-wider mt-1">Earned</span>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-4 mt-auto mb-8">
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
      
      {/* Debug link display */}
      <div className="text-[10px] text-gray-400 break-all text-center max-w-full px-4">
        {inviteLink}
      </div>
    </div>
  );
};

export default Referral;