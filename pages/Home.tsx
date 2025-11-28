
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { hapticFeedback, notificationFeedback, safeAlert } from '../services/telegramService';
import { redeemPromoCode, getAppConfig } from '../services/dbService';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface HomeProps {
  user: User;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  // Promo Code State
  const [promoCode, setPromoCode] = useState("");
  const [claimingPromo, setClaimingPromo] = useState(false);
  
  // Chart Data
  const [chartData, setChartData] = useState<any[]>([]);
  const [dailyAdLimit, setDailyAdLimit] = useState(20);

  useEffect(() => {
    // 1. Prepare Chart Data (Last 7 days)
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      data.push({
        name: label,
        earnings: user.earningsHistory?.[dateKey] || 0
      });
    }
    setChartData(data);

    // 2. Fetch Ad Limit
    getAppConfig().then(cfg => {
        if (cfg.dailyAdLimit) setDailyAdLimit(cfg.dailyAdLimit);
    });

  }, [user.earningsHistory]);

  const handleClaimPromo = async () => {
    if (!promoCode.trim()) return;
    hapticFeedback('medium');
    setClaimingPromo(true);
    
    try {
      const result = await redeemPromoCode(user.id, promoCode.trim());
      if (result.success) {
        notificationFeedback('success');
        safeAlert(result.message);
        setPromoCode("");
        // Note: Real balance update happens via App.tsx sync or reload, 
        // but typically requires a state lift or context. 
        // For now user sees alert and balance updates on next interaction/sync.
        // To force visual update we could reload but that's harsh. 
        // The DB is updated so page refresh works.
        // Ideally we pass `onUpdate` prop to Home too, but avoiding refactor cascade.
        window.location.reload(); 
      } else {
        notificationFeedback('error');
        safeAlert(result.message);
      }
    } catch (e) {
      safeAlert("Error claiming code.");
    } finally {
      setClaimingPromo(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-4 pb-24 px-4 relative overflow-x-hidden animate-fade-in transition-colors duration-500 bg-gray-50 dark:bg-[#0d0d0d]">
      
      {/* --- HEADER: PROFILE & MENU --- */}
      <div className="flex flex-col items-center w-full mb-6 relative">
        {/* Absolute Buttons */}
        <div className="absolute top-0 right-0 flex space-x-2 z-20">
            <button onClick={toggleTheme} className="p-2 bg-white/50 dark:bg-white/10 rounded-full shadow-sm text-black dark:text-white">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => navigate('/admin')} className="p-2 bg-white/50 dark:bg-white/10 rounded-full shadow-sm text-black dark:text-white">
              ⚙️
            </button>
        </div>

        {/* Centered Profile (As per screenshot) */}
        <div className="relative mt-2">
            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-blue-400 to-purple-500 shadow-xl">
               <img 
                 src={user.photoUrl || "https://picsum.photos/200"} 
                 alt="Profile" 
                 className="w-full h-full rounded-full object-cover border-4 border-white dark:border-black"
               />
            </div>
            {user.isPremium && (
                <div className="absolute bottom-0 right-0 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                    PRO
                </div>
            )}
        </div>
        
        <h2 className="text-xl font-black mt-3 text-gray-900 dark:text-white uppercase tracking-wide font-display">
          {user.firstName} {user.lastName}
        </h2>
        
        {/* Balance Display */}
        <div className="flex items-center mt-1 space-x-2 bg-white/60 dark:bg-white/5 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/10">
           <img src="https://cdn-icons-png.flaticon.com/512/12423/12423924.png" className="w-5 h-5" alt="coin"/>
           <span className="text-lg font-bold text-gray-800 dark:text-white">{user.balance.toLocaleString()}</span>
        </div>
      </div>

      {/* --- PROMO CODE SECTION --- */}
      <div className="glass-panel bg-white dark:bg-[#1c1c1e] p-5 rounded-[24px] shadow-ios-light dark:shadow-none mb-6 border border-gray-100 dark:border-white/5">
         <div className="flex items-center space-x-2 mb-3">
            <span className="text-blue-500 text-xl">🎁</span>
            <span className="font-bold text-gray-900 dark:text-white">Promo Code</span>
         </div>
         <div className="flex space-x-2">
            <input 
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter Promo Code"
              className="flex-1 bg-gray-100 dark:bg-black/30 border border-transparent focus:border-blue-500 rounded-xl px-4 py-3 text-sm dark:text-white outline-none transition-all"
            />
            <button 
              onClick={handleClaimPromo}
              disabled={claimingPromo || !promoCode}
              className="bg-ios-primary text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-transform disabled:opacity-50"
            >
              {claimingPromo ? '...' : 'Claim'}
            </button>
         </div>
      </div>

      {/* --- STATS GRID (4 Boxes) --- */}
      <div className="grid grid-cols-2 gap-3 mb-6">
         {/* Box 1: Today Ads */}
         <div className="glass-panel bg-white dark:bg-[#1c1c1e] p-4 rounded-[20px] border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-gray-400 uppercase mb-1">Today Ads</span>
            <span className="text-xl font-black text-blue-500">
               {user.adWatchCount || 0} <span className="text-gray-400 text-sm font-medium">/ {dailyAdLimit}</span>
            </span>
         </div>
         {/* Box 2: Total Ads */}
         <div className="glass-panel bg-white dark:bg-[#1c1c1e] p-4 rounded-[20px] border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-gray-400 uppercase mb-1">Total Ads</span>
            <span className="text-xl font-black text-purple-500">{user.totalAdWatchCount || 0}</span>
         </div>
         {/* Box 3: Total Referrals */}
         <div className="glass-panel bg-white dark:bg-[#1c1c1e] p-4 rounded-[20px] border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-gray-400 uppercase mb-1">Total Referrals</span>
            <span className="text-xl font-black text-green-500">{user.referralCount || 0}</span>
         </div>
         {/* Box 4: Total Earnings */}
         <div className="glass-panel bg-white dark:bg-[#1c1c1e] p-4 rounded-[20px] border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-gray-400 uppercase mb-1">Total Earnings</span>
            <span className="text-xl font-black text-orange-500">{user.lifetimeEarnings ? user.lifetimeEarnings.toLocaleString() : 0}</span>
         </div>
      </div>

      {/* --- CHART SECTION --- */}
      <div className="glass-panel bg-white dark:bg-[#1c1c1e] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5">
         <h3 className="font-bold text-gray-900 dark:text-white mb-4">Last 7 Days Earnings</h3>
         <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                     <linearGradient id="colorEarn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#888'}} 
                    interval={1}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backgroundColor: theme === 'dark' ? '#333' : '#fff'}}
                    itemStyle={{color: theme === 'dark' ? '#fff' : '#000', fontSize: '12px', fontWeight: 'bold'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#007AFF" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorEarn)" 
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

    </div>
  );
};

export default Home;
