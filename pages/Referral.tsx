import React, { useState } from 'react';
import { User } from '../types';
import { hapticFeedback, notificationFeedback } from '../services/telegramService';

interface ReferralProps {
  user: User;
}

const Referral: React.FC<ReferralProps> = ({ user }) => {
  const [copied, setCopied] = useState(false);
  const inviteLink = `https://t.me/GeminiGoldRushBot?start=${user.referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    notificationFeedback('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    hapticFeedback('medium');
    const text = `Join me on Gemini Gold Rush and earn coins! 🚀`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink(url);
  };

  return (
    <div className="flex flex-col h-screen pt-8 pb-24 px-6 animate-fade-in items-center">
      <div className="w-32 h-32 bg-gradient-to-tr from-green-400 to-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-green-500/20 rotate-12">
        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      </div>

      <h2 className="text-3xl font-bold text-center mb-2">Invite Friends</h2>
      <p className="text-center text-ios-subtext text-sm mb-8 max-w-[250px]">
        Earn <span className="text-green-400 font-bold">1,000 GP</span> for every friend who joins using your link.
      </p>

      {/* Stats */}
      <div className="w-full grid grid-cols-2 gap-4 mb-8">
        <div className="bg-ios-card rounded-2xl p-4 flex flex-col items-center border border-white/5">
          <span className="text-2xl font-bold text-white">0</span>
          <span className="text-xs text-ios-subtext">Friends</span>
        </div>
        <div className="bg-ios-card rounded-2xl p-4 flex flex-col items-center border border-white/5">
          <span className="text-2xl font-bold text-ios-gold">0</span>
          <span className="text-xs text-ios-subtext">Earned</span>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-4 mt-auto mb-8">
        <button 
          onClick={handleShare}
          className="w-full bg-white text-black font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          Invite Friends
        </button>
        
        <button 
          onClick={handleCopy}
          className="w-full bg-ios-card border border-white/10 text-white font-semibold py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center relative overflow-hidden"
        >
          {copied ? (
             <span className="flex items-center text-green-400 animate-fade-in">
               <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
               Copied!
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