import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback } from '../services/telegramService';

interface HomeProps {
  user: User;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  // Simple number animation
  const [displayBalance, setDisplayBalance] = useState(0);

  useEffect(() => {
    let start = displayBalance;
    const end = user.balance;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      
      setDisplayBalance(Math.floor(start + (end - start) * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.balance]);

  const handleThemeToggle = () => {
    hapticFeedback('light');
    toggleTheme();
  };

  return (
    <div className="flex flex-col items-center pt-6 pb-24 px-4 min-h-screen relative overflow-hidden animate-fade-in transition-colors duration-500">
      
      {/* Header Area */}
      <div className="flex items-center justify-between w-full mb-8 z-20">
        {/* User Profile */}
        <div className="flex items-center space-x-3 bg-white/60 dark:bg-ios-dark-card/50 glass-panel p-2 pr-4 rounded-[20px] border border-ios-border dark:border-white/5 shadow-sm">
          <img 
            src={user.photoUrl || "https://picsum.photos/200"} 
            alt="Profile" 
            className="w-10 h-10 rounded-full border-2 border-white dark:border-ios-gold shadow-md"
          />
          <div className="flex flex-col">
            <span className="text-[10px] text-ios-subtext uppercase tracking-wider font-bold">Hello</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[100px]">{user.firstName}</span>
          </div>
        </div>
        
        <div className="flex space-x-3">
          {/* Theme Toggle */}
          <button 
            onClick={handleThemeToggle}
            className="w-10 h-10 rounded-full bg-white/60 dark:bg-ios-dark-card/50 glass-panel border border-ios-border dark:border-white/10 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>

          {/* Admin Settings */}
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-white/60 dark:bg-ios-dark-card/50 glass-panel border border-ios-border dark:border-white/10 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-ios-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      {/* Main Balance with 3D Float Effect */}
      <div className="flex flex-col items-center justify-center mt-4 mb-12 relative z-10 w-full">
        <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-ios-gold to-orange-400 blur-[80px] opacity-30 absolute -z-10 animate-pulse-slow"></div>
        
        <div className="relative animate-float">
          <img 
            src="https://cdn-icons-png.flaticon.com/512/12423/12423924.png" 
            alt="Coin" 
            className="w-40 h-40 mb-4 drop-shadow-2xl"
          />
        </div>

        <h1 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter drop-shadow-lg font-display">
          {displayBalance.toLocaleString()}
        </h1>
        <p className="text-ios-primary dark:text-ios-gold font-bold mt-2 text-sm tracking-[0.2em] uppercase opacity-90">Gemini Points</p>
      </div>

      {/* Stats Grid - Glass Cards */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 border border-ios-border dark:border-white/10 rounded-3xl p-5 flex flex-col items-center shadow-ios-light dark:shadow-none transition-all hover:scale-[1.02]">
          <span className="text-3xl mb-2 drop-shadow-sm">⚡</span>
          <span className="text-xs font-semibold text-ios-subtext dark:text-gray-400 uppercase tracking-wide">Energy</span>
          <span className="text-xl font-bold text-gray-800 dark:text-white">100/100</span>
        </div>
        <div className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 border border-ios-border dark:border-white/10 rounded-3xl p-5 flex flex-col items-center shadow-ios-light dark:shadow-none transition-all hover:scale-[1.02]">
          <span className="text-3xl mb-2 drop-shadow-sm">🏆</span>
          <span className="text-xs font-semibold text-ios-subtext dark:text-gray-400 uppercase tracking-wide">Rank</span>
          <span className="text-xl font-bold text-gray-800 dark:text-white">#9,212</span>
        </div>
      </div>

      {/* Daily Reward Teaser - Premium Gradient */}
      <div className="mt-6 w-full glass-panel bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-yellow-900/30 dark:to-orange-900/30 border border-orange-200 dark:border-yellow-500/20 rounded-3xl p-5 flex justify-between items-center shadow-ios-light dark:shadow-none">
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 dark:text-yellow-100 text-lg">Daily Reward</span>
          <span className="text-xs text-gray-500 dark:text-yellow-200/70 font-medium mt-1">Available in 12h 30m</span>
        </div>
        <button className="bg-white dark:bg-yellow-500 text-gray-400 dark:text-black text-xs font-bold px-5 py-3 rounded-full shadow-sm dark:opacity-80 cursor-not-allowed">
          Claimed
        </button>
      </div>
    </div>
  );
};

export default Home;
