
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Referral from './pages/Referral';
import Earn from './pages/Earn';
import Admin from './pages/Admin';
import BottomNav from './components/BottomNav';
import { ThemeProvider } from './contexts/ThemeContext';
import { initTelegram, getTelegramUser } from './services/telegramService';
import { getUserData, createUser, getAppConfig } from './services/dbService';
import { User, AppConfig } from './types';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  
  // IMMEDIATE INITIALIZATION: Get user from Telegram data synchronously.
  // This ensures the UI renders INSTANTLY without a loading screen.
  const [user, setUser] = useState<User | null>(() => {
    initTelegram();
    return getTelegramUser();
  });

  const [config, setConfig] = useState<AppConfig>({
    adReward: 150,
    referralBonus: 1000,
    referralBonusPremium: 5000,
    maintenanceMode: false,
    telegramChannelUrl: "",
    miniAppUrl: ""
  });
  
  const location = useLocation();

  // Background Data Sync
  useEffect(() => {
    let isMounted = true;
    
    const syncData = async () => {
      // If we don't have a user from initData, we can't do anything
      const currentUser = getTelegramUser();
      if (!currentUser) return;

      try {
        // Fetch DB data in background
        const [existingUser, appConfig] = await Promise.all([
           getUserData(currentUser.id),
           getAppConfig()
        ]);
        
        if (isMounted) {
           setConfig(appConfig);
           if (existingUser) {
             // Update with real balance from DB
             setUser(existingUser);
           } else {
             // Create user in background if new
             const newUser = await createUser(currentUser);
             setUser(newUser);
           }
        }
      } catch (error) {
        console.error("Background Sync Error", error);
      }
    };
    
    syncData();
    
    return () => { isMounted = false; };
  }, []);

  // Sync BottomNav with Route
  useEffect(() => {
    const path = location.pathname.replace('/', '');
    if (path === 'admin') return; // Don't highlight for admin
    if (path === '') setActiveTab('home');
    else setActiveTab(path);
  }, [location]);

  const handleBalanceUpdate = (newBalance: number) => {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = `#/${tab}`;
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center text-black dark:text-white bg-gray-100 dark:bg-black p-4 text-center">
        <p>Could not authenticate user. Please open in Telegram.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ios-text dark:text-ios-dark-text font-sans selection:bg-ios-gold selection:text-black transition-colors duration-500 bg-ios-bg dark:bg-ios-dark-bg">
      {/* Global Background Effect - Dynamic based on theme */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Light Mode Blobs */}
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-300/30 rounded-full blur-[100px] animate-pulse-slow dark:hidden"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-yellow-300/30 rounded-full blur-[100px] animate-pulse-slow dark:hidden"></div>
          
          {/* Dark Mode Blobs */}
          <div className="hidden dark:block absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] animate-pulse-slow"></div>
          <div className="hidden dark:block absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[100px] animate-pulse-slow"></div>
      </div>

      <main className="w-full max-w-md mx-auto min-h-screen relative z-10 pb-20">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/home" element={<Home user={user} />} />
          <Route path="/leaderboard" element={<Leaderboard currentUser={user} />} />
          <Route path="/referral" element={<Referral user={user} />} />
          <Route path="/earn" element={<Earn user={user} onUpdate={handleBalanceUpdate} config={config} />} />
          <Route path="/admin" element={<Admin currentUser={user} onConfigUpdate={setConfig} />} />
        </Routes>
      </main>

      {/* Navigation (Hidden on Admin page) */}
      {location.pathname !== '/admin' && (
        <BottomNav currentTab={activeTab} setTab={navigateToTab} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </HashRouter>
  );
};

export default App;
