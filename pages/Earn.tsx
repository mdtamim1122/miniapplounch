import React, { useState } from 'react';
import { User, AppConfig } from '../types';
import { updateUserBalance } from '../services/dbService';
import { hapticFeedback, notificationFeedback, safeAlert } from '../services/telegramService';
import { useTheme } from '../contexts/ThemeContext';

interface EarnProps {
  user: User;
  onUpdate: (newBalance: number) => void;
  config: AppConfig;
}

const Earn: React.FC<EarnProps> = ({ user, onUpdate, config }) => {
  const [adLoading, setAdLoading] = useState(false);
  const { theme } = useTheme();

  const watchAd = async () => {
    if (adLoading) return;
    
    // Check maintenance mode
    if (config.maintenanceMode) {
        safeAlert("Earning is temporarily disabled for maintenance.");
        return;
    }

    hapticFeedback('medium');
    setAdLoading(true);

    try {
      // Check if GigaPub script is loaded
      if (typeof window.showGiga !== 'function') {
        throw new Error("Ad service not ready");
      }

      await window.showGiga();
      
      // Dynamic Reward from Config
      const reward = config.adReward;
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
    <div className="flex flex-col h-screen pt-6 pb-24 px-4 animate-slide-up transition-colors duration-500">
      <h2 className="text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white font-display">Earn Coins</h2>

      {/* Highlighted Task - Video Ad */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-purple-900 dark:to-indigo-900 rounded-[30px] p-6 mb-8 shadow-xl shadow-indigo-500/20 dark:shadow-none border border-white/10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-700"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner">
              🎬
            </div>
            <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">
              Recommended
            </span>
          </div>

          <h3 className="text-2xl font-bold text-white mb-1">Watch Ads</h3>
          <p className="text-sm text-indigo-100 mb-6 font-medium opacity-90">Watch a short video to earn instant rewards.</p>
          
          <button 
            onClick={watchAd}
            disabled={adLoading || config.maintenanceMode}
            className={`w-full bg-white text-indigo-600 font-bold py-3.5 px-6 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${adLoading ? 'opacity-90' : 'hover:bg-indigo-50'}`}
          >
            {adLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </>
            ) : (
              <>
                <span className="mr-2">Watch Now</span>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-black px-2 py-0.5 rounded-md">+{config.adReward} GP</span>
              </>
            )}
          </button>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 px-1">Task List</h3>
      
      <div className="space-y-4 overflow-y-auto pb-4 no-scrollbar">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 border border-ios-border dark:border-white/5 rounded-[24px] p-4 flex items-center justify-between shadow-sm hover:bg-white dark:hover:bg-ios-dark-card transition-colors">
             <div className="flex items-center">
               <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-xl mr-4 text-blue-600 dark:text-blue-400">
                 📣
               </div>
               <div>
                 <div className="font-bold text-gray-900 dark:text-white text-base">Join Channel</div>
                 <div className="text-xs font-semibold text-ios-primary dark:text-ios-gold mt-0.5">+500 GP</div>
               </div>
             </div>
             <button className="px-5 py-2 bg-gray-100 dark:bg-white/10 rounded-full text-xs font-bold text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
               Start
             </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Earn;
