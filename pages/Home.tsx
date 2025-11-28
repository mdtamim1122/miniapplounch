import React, { useEffect, useState } from 'react';
import { User } from '../types';

interface HomeProps {
  user: User;
}

const Home: React.FC<HomeProps> = ({ user }) => {
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

  return (
    <div className="flex flex-col items-center pt-8 pb-24 px-4 min-h-screen relative overflow-hidden animate-fade-in">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-gradient-to-b from-blue-900/20 to-transparent rounded-[100%] blur-3xl -z-10 pointer-events-none" />

      {/* User Header */}
      <div className="flex items-center space-x-3 mb-8 w-full max-w-sm bg-ios-card/50 backdrop-blur-md p-3 rounded-2xl border border-white/5">
        <img 
          src={user.photoUrl || "https://picsum.photos/200"} 
          alt="Profile" 
          className="w-10 h-10 rounded-full border-2 border-ios-gold shadow-lg"
        />
        <div className="flex flex-col">
          <span className="text-xs text-ios-subtext uppercase tracking-wider">Welcome back</span>
          <span className="text-sm font-bold text-white">{user.firstName} {user.lastName}</span>
        </div>
      </div>

      {/* Main Balance */}
      <div className="flex flex-col items-center justify-center mt-4 mb-12 relative z-10">
        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-yellow-600/20 to-transparent blur-3xl absolute -z-10 animate-pulse-slow"></div>
        <img 
          src="https://cdn-icons-png.flaticon.com/512/12423/12423924.png" // Placeholder coin image
          alt="Coin" 
          className="w-32 h-32 mb-4 drop-shadow-2xl animate-[bounce_3s_infinite]"
        />
        <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-xl">
          {displayBalance.toLocaleString()}
        </h1>
        <p className="text-ios-gold font-medium mt-2 text-sm tracking-widest uppercase">Gemini Points</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <div className="bg-ios-card/80 backdrop-blur border border-white/10 rounded-2xl p-4 flex flex-col items-center">
          <span className="text-2xl mb-2">⚡</span>
          <span className="text-xs text-ios-subtext">Energy</span>
          <span className="text-lg font-bold">100/100</span>
        </div>
        <div className="bg-ios-card/80 backdrop-blur border border-white/10 rounded-2xl p-4 flex flex-col items-center">
          <span className="text-2xl mb-2">🏆</span>
          <span className="text-xs text-ios-subtext">Rank</span>
          <span className="text-lg font-bold">#9,212</span>
        </div>
      </div>

      {/* Daily Reward Teaser */}
      <div className="mt-6 w-full max-w-sm bg-gradient-to-r from-yellow-800/40 to-yellow-600/40 border border-yellow-500/30 rounded-2xl p-4 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="font-bold text-yellow-100">Daily Reward</span>
          <span className="text-xs text-yellow-200/70">Come back tomorrow</span>
        </div>
        <button className="bg-yellow-500 text-black text-xs font-bold px-4 py-2 rounded-full opacity-50 cursor-not-allowed">
          Claimed
        </button>
      </div>
    </div>
  );
};

export default Home;
