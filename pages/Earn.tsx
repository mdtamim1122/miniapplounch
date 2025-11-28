import React, { useState } from 'react';
import { User } from '../types';
import { updateUserBalance } from '../services/dbService';
import { hapticFeedback, notificationFeedback, safeAlert } from '../services/telegramService';

interface EarnProps {
  user: User;
  onUpdate: (newBalance: number) => void;
}

const Earn: React.FC<EarnProps> = ({ user, onUpdate }) => {
  const [adLoading, setAdLoading] = useState(false);

  const watchAd = async () => {
    if (adLoading) return;
    
    hapticFeedback('medium');
    setAdLoading(true);

    try {
      // Check if GigaPub script is loaded
      if (typeof window.showGiga !== 'function') {
        throw new Error("Ad service not ready");
      }

      await window.showGiga();
      
      // Reward Logic
      const reward = 150;
      const newBal = await updateUserBalance(user.id, reward);
      onUpdate(newBal);
      notificationFeedback('success');
      safeAlert(`You earned ${reward} GP!`);
      
    } catch (e) {
      console.error(e);
      notificationFeedback('error');
      // safeAlert('Ad failed to load or was closed. Please try again.');
    } finally {
      setAdLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen pt-6 pb-24 px-4 animate-slide-up">
      <h2 className="text-3xl font-bold text-center mb-6">Earn Coins</h2>

      {/* Highlighted Task */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-5 mb-6 shadow-lg border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-1">Watch Video Ads</h3>
          <p className="text-sm text-purple-200 mb-4">Watch a short promotional video to earn instant rewards.</p>
          
          <button 
            onClick={watchAd}
            disabled={adLoading}
            className={`bg-white text-purple-900 font-bold py-2 px-6 rounded-lg shadow-md transition-all active:scale-95 flex items-center ${adLoading ? 'opacity-80' : ''}`}
          >
            {adLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-purple-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading Ad...
              </>
            ) : (
              <>
                <span>Watch Ad</span>
                <span className="ml-2 bg-purple-200 text-purple-900 text-xs px-2 py-0.5 rounded-full">+150 GP</span>
              </>
            )}
          </button>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3">Task List</h3>
      <div className="space-y-3 overflow-y-auto pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-ios-card border border-white/5 rounded-xl p-4 flex items-center justify-between">
             <div className="flex items-center">
               <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-xl mr-3">
                 📣
               </div>
               <div>
                 <div className="font-semibold text-sm">Join Telegram Channel</div>
                 <div className="text-xs text-ios-subtext">+500 GP</div>
               </div>
             </div>
             <button className="px-4 py-1.5 bg-white/10 rounded-full text-xs font-semibold hover:bg-white/20 transition-colors">
               Start
             </button>
          </div>
        ))}
        
        <div className="bg-ios-card border border-white/5 rounded-xl p-4 flex items-center justify-between opacity-50">
             <div className="flex items-center">
               <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center text-xl mr-3">
                 🔒
               </div>
               <div>
                 <div className="font-semibold text-sm">Premium Task</div>
                 <div className="text-xs text-ios-subtext">Unlock at Level 5</div>
               </div>
             </div>
             <button disabled className="px-4 py-1.5 bg-transparent border border-white/10 rounded-full text-xs font-semibold">
               Locked
             </button>
          </div>
      </div>
    </div>
  );
};

export default Earn;