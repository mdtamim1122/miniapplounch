import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { getAppConfig, updateAppConfig, getTotalUserCount } from '../services/dbService';
import { safeAlert, notificationFeedback } from '../services/telegramService';
import { useNavigate } from 'react-router-dom';

interface AdminProps {
  currentUser: User;
  onConfigUpdate: (config: AppConfig) => void;
}

const ADMIN_ID = "mz6zLhUvWgYGakFEb0iy9CAvgiE2";

const Admin: React.FC<AdminProps> = ({ currentUser, onConfigUpdate }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check authentication
    if (currentUser.id === ADMIN_ID) {
      setIsAuthenticated(true);
      loadData();
    }
  }, [currentUser.id]);

  const loadData = async () => {
    setLoading(true);
    const cfg = await getAppConfig();
    const count = await getTotalUserCount();
    setConfig(cfg);
    setUserCount(count);
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "2024" || currentUser.id === ADMIN_ID) {
      setIsAuthenticated(true);
      notificationFeedback('success');
      loadData();
    } else {
      notificationFeedback('error');
      safeAlert("Incorrect Access PIN");
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setLoading(true);
    await updateAppConfig(config);
    onConfigUpdate(config); // Update global state
    notificationFeedback('success');
    safeAlert("Settings Saved Successfully!");
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-black transition-colors duration-500">
        <div className="w-20 h-20 bg-red-500/10 rounded-[24px] flex items-center justify-center mb-6 animate-pulse border border-red-500/20">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Admin Access</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-center text-sm">Restricted Area. Please identify yourself.</p>
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter Admin PIN"
            className="w-full bg-white dark:bg-ios-dark-card border border-gray-200 dark:border-white/10 rounded-[18px] px-4 py-4 text-center text-lg text-gray-900 dark:text-white focus:border-ios-primary dark:focus:border-ios-gold focus:outline-none transition-colors shadow-sm"
          />
          <button type="submit" className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-[18px] active:scale-95 transition-transform shadow-lg">
            Verify Access
          </button>
          <button type="button" onClick={() => navigate('/')} className="w-full text-gray-500 text-sm mt-4 hover:text-gray-800 dark:hover:text-white transition-colors">
            Return Home
          </button>
        </form>
      </div>
    );
  }

  if (!config) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading Admin Panel...</div>;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 animate-fade-in transition-colors duration-500 bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-ios-primary to-purple-500 dark:from-ios-gold dark:to-yellow-200 font-display">
          Admin Panel
        </h1>
        <button onClick={() => navigate('/')} className="bg-white dark:bg-ios-dark-card p-3 rounded-full shadow-sm border border-gray-100 dark:border-white/10 text-gray-900 dark:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-900/60 dark:to-blue-800/40 border border-blue-400/30 p-5 rounded-[24px] relative overflow-hidden shadow-lg shadow-blue-500/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl rounded-full -mr-6 -mt-6"></div>
          <div className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-2">Total Users</div>
          <div className="text-3xl font-black text-white">{userCount.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 dark:from-purple-900/60 dark:to-purple-800/40 border border-purple-400/30 p-5 rounded-[24px] relative overflow-hidden shadow-lg shadow-purple-500/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl rounded-full -mr-6 -mt-6"></div>
          <div className="text-purple-100 text-xs font-bold uppercase tracking-wider mb-2">Server Status</div>
          <div className="text-3xl font-black text-white flex items-center">
            <span className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
            OK
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-1">Economy Settings</h3>
        
        {/* Ad Reward */}
        <div className="glass-panel bg-white dark:bg-ios-dark-card border border-gray-200 dark:border-white/10 rounded-[24px] p-5 shadow-sm">
          <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 block mb-3">Video Ad Reward (GP)</label>
          <div className="flex items-center space-x-4">
            <input 
              type="number" 
              value={config.adReward}
              onChange={(e) => setConfig({...config, adReward: Number(e.target.value)})}
              className="flex-1 bg-gray-100 dark:bg-black/50 border border-transparent dark:border-white/20 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 dark:text-white focus:border-ios-primary dark:focus:border-ios-gold outline-none transition-colors"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">Points user gets per ad watch.</p>
        </div>

        {/* Referral Bonus */}
        <div className="glass-panel bg-white dark:bg-ios-dark-card border border-gray-200 dark:border-white/10 rounded-[24px] p-5 shadow-sm">
          <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 block mb-3">Referral Bonus (GP)</label>
          <div className="flex items-center space-x-4">
            <input 
              type="number" 
              value={config.referralBonus}
              onChange={(e) => setConfig({...config, referralBonus: Number(e.target.value)})}
              className="flex-1 bg-gray-100 dark:bg-black/50 border border-transparent dark:border-white/20 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 dark:text-white focus:border-ios-primary dark:focus:border-ios-gold outline-none transition-colors"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">Points both users get on invite.</p>
        </div>

        {/* Maintenance Toggle */}
        <div className="glass-panel bg-white dark:bg-ios-dark-card border border-gray-200 dark:border-white/10 rounded-[24px] p-5 flex items-center justify-between shadow-sm">
          <div>
            <label className="text-base font-bold text-gray-900 dark:text-white block">Maintenance Mode</label>
            <p className="text-xs text-gray-500 mt-1">Stop users from earning.</p>
          </div>
          <button 
            onClick={() => setConfig({...config, maintenanceMode: !config.maintenanceMode})}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${config.maintenanceMode ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${config.maintenanceMode ? 'translate-x-6' : ''}`}></div>
          </button>
        </div>

        {/* Save Action */}
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-gray-900 dark:bg-gradient-to-r dark:from-ios-gold dark:to-yellow-600 text-white dark:text-black font-bold text-lg py-4 rounded-[20px] shadow-lg active:scale-95 transition-transform flex items-center justify-center mt-8"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
        
        <div className="text-center text-[10px] text-gray-400 font-mono mt-4 opacity-50">
          ID: {currentUser.id}
        </div>
      </div>
    </div>
  );
};

export default Admin;
