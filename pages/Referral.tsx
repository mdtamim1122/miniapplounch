
import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { hapticFeedback, notificationFeedback } from '../services/telegramService';
import { useTheme } from '../contexts/ThemeContext';
import { getAppConfig, getReferredUsers } from '../services/dbService';

interface ReferralProps {
  user: User;
}

const Referral: React.FC<ReferralProps> = ({ user }) => {
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [loadingLink, setLoadingLink] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  // My Referrals List State
  const [showReferrals, setShowReferrals] = useState(false);
  const [referrals, setReferrals] = useState<User[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  const { theme } = useTheme();

  // Load Config to get the Mini App URL dynamically
  useEffect(() => {
    const loadConfig = async () => {
      const cfg = await getAppConfig();
      setConfig(cfg);
      // Generate Direct Start App Link: t.me/bot/app?startapp=CODE
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

  const toggleReferralList = async () => {
    hapticFeedback('light');
    if (!showReferrals) {
      setLoadingReferrals(true);
      const refs = await getReferredUsers(user.id);
      setReferrals(refs);
      setLoadingReferrals(false);
    }
    setShowReferrals(!showReferrals);
  };

  return (
    <div className="flex flex-col h-screen pt-8 pb-24 px-6 animate-fade-in items-center transition-colors duration-500 overflow-y-auto no-scrollbar">
      
      {/* 3D Icon */}
      <div className="w-32 h-32 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-[35px] flex items-center justify-center mb-6 shadow-2xl shadow-green-500/30 rotate-12 animate-float shrink-0">
        <svg className="w-16 h-16 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      </div>

      <h2 className="text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white font-display shrink-0">Invite Friends</h2>
      
      <div className="w-full grid grid-cols-2 gap-3 mb-6 shrink-0">
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
      <div className="w-full grid grid-cols-2 gap-4 mb-4 shrink-0">
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 rounded-[24px] p-5 flex flex-col items-center border border-ios-border dark:border-white/5 shadow-ios-light dark:shadow-none">
          <span className="text-3xl font-black text-gray-900 dark:text-white">{user.referralCount || 0}</span>
          <span className="text-xs font-bold text-ios-subtext uppercase tracking-wider mt-1">Friends</span>
        </div>
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 rounded-[24px] p-5 flex flex-col items-center border border-ios-border dark:border-white/5 shadow-ios-light dark:shadow-none">
          <span className="text-3xl font-black text-ios-primary dark:text-ios-gold">{(user.totalReferralRewards || 0).toLocaleString()}</span>
          <span className="text-xs font-bold text-ios-subtext uppercase tracking-wider mt-1">Earned</span>
        </div>
      </div>

      {/* Referral Link Display Box - IMPROVED VISIBILITY */}
      <div className="w-full glass-panel bg-white dark:bg-white/5 border-2 border-dashed border-gray-300 dark:border-white/20 p-5 rounded-2xl mb-4 text-center relative overflow-hidden group shrink-0 shadow-sm">
         <p className="text-xs text-ios-primary dark:text-ios-gold font-bold uppercase tracking-widest mb-2">Your Invite Link</p>
         <div className="bg-gray-100 dark:bg-black/40 p-3 rounded-xl">
             <p className="font-mono text-sm font-black text-gray-900 dark:text-white break-all select-all">
               {loadingLink ? "Generating Link..." : inviteLink}
             </p>
         </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3 shrink-0">
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

      {/* Referral List Toggle */}
      <div className="w-full mt-6 mb-4 shrink-0">
         <button onClick={toggleReferralList} className="w-full flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/20 hover:bg-white/70 dark:hover:bg-white/10 transition-colors">
             <span className="font-bold text-gray-700 dark:text-white">See My Referrals</span>
             <svg className={`w-5 h-5 transition-transform ${showReferrals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
         </button>
      </div>

      {/* Referral List */}
      {showReferrals && (
        <div className="w-full space-y-3 pb-8 animate-slide-up">
           {loadingReferrals && <div className="text-center text-gray-500 py-4">Loading list...</div>}
           
           {!loadingReferrals && referrals.length === 0 && (
              <div className="text-center text-gray-400 py-6 bg-white/30 dark:bg-white/5 rounded-2xl">
                 No referrals yet. Invite someone!
              </div>
           )}

           {!loadingReferrals && referrals.map(refUser => (
             <div key={refUser.id} className="glass-panel bg-white dark:bg-ios-dark-card p-4 rounded-2xl flex items-center border border-gray-100 dark:border-white/5 shadow-sm">
                <img src={refUser.photoUrl || "https://picsum.photos/100"} className="w-10 h-10 rounded-full bg-gray-200 mr-3 border border-gray-100 dark:border-white/10" alt="u"/>
                <div className="flex-1 min-w-0">
                   <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{refUser.firstName}</div>
                   <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">ID: {refUser.id.substring(0,8)}...</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">You Earned</div>
                    <div className="font-bold text-green-500 text-sm bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-lg inline-block">
                        +{refUser.earnedFromReferrer || 0}
                    </div>
                </div>
             </div>
           ))}
        </div>
      )}

    </div>
  );
};

export default Referral;
