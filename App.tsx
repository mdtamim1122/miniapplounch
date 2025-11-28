
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
import { getUserData, createUser, getAppConfig, updateAppConfig } from './services/dbService';
import { User, AppConfig } from './types';

// --- SPLASH SCREEN COMPONENT ---
const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-500">
      <div className="relative animate-float">
         {/* Glow Effect */}
         <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 rounded-full scale-150"></div>
         <img 
            src="https://cdn-icons-png.flaticon.com/512/12423/12423924.png" 
            alt="Logo" 
            className="w-28 h-28 relative z-10 drop-shadow-2xl"
         />
      </div>
      <h1 className="text-2xl font-black text-white mt-8 tracking-wider font-display animate-pulse">GEMINI GOLD</h1>
      
      {/* Loading Bar */}
      <div className="w-48 h-1 bg-white/10 rounded-full mt-6 overflow-hidden">
        <div className="h-full bg-yellow-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '50%' }}></div>
      </div>
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

// --- MAINTENANCE SCREEN WITH COUNTDOWN ---
const MaintenanceScreen: React.FC<{ endTime?: string }> = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState<{d: number, h: number, m: number, s: number} | null>(null);

  useEffect(() => {
    if (!endTime) return;
    const target = new Date(endTime).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;

      if (distance < 0) {
        clearInterval(interval);
        window.location.reload(); // Reload to enter app
        return;
      }

      setTimeLeft({
        d: Math.floor(distance / (1000 * 60 * 60 * 24)),
        h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-6 text-center">
       <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
       </div>
       <h1 className="text-3xl font-black mb-2 uppercase">Under Maintenance</h1>
       <p className="text-gray-400 mb-8 max-w-xs">We are currently upgrading our servers to provide you with a better experience.</p>
       
       {timeLeft ? (
         <div className="grid grid-cols-4 gap-3 mb-8">
            <div className="bg-white/10 p-3 rounded-xl min-w-[60px]">
               <div className="text-2xl font-bold">{timeLeft.d}</div>
               <div className="text-[10px] text-gray-400 uppercase">Days</div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl min-w-[60px]">
               <div className="text-2xl font-bold">{timeLeft.h}</div>
               <div className="text-[10px] text-gray-400 uppercase">Hrs</div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl min-w-[60px]">
               <div className="text-2xl font-bold">{timeLeft.m}</div>
               <div className="text-[10px] text-gray-400 uppercase">Mins</div>
            </div>
            <div className="bg-white/10 p-3 rounded-xl min-w-[60px]">
               <div className="text-2xl font-bold">{timeLeft.s}</div>
               <div className="text-[10px] text-gray-400 uppercase">Secs</div>
            </div>
         </div>
       ) : (
         <p className="text-yellow-500 font-bold mb-8 animate-pulse">Estimating time...</p>
       )}
       
       <p className="text-xs text-gray-600">Please check back later.</p>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoading, setIsLoading] = useState(true); // Control Splash Screen
  
  // Get user synchronously so we have data available
  const [user, setUser] = useState<User | null>(() => {
    return getTelegramUser();
  });

  const [config, setConfig] = useState<AppConfig>({
    adReward: 150,
    referralBonus: 1000,
    referralBonusPremium: 5000,
    maintenanceMode: false,
    telegramChannelUrl: "",
    miniAppUrl: "",
    botToken: ""
  });
  
  const location = useLocation();

  // 1. Initialize Telegram & Loading Sequence
  useEffect(() => {
    initTelegram();
    
    // Force a minimum splash time (e.g. 2 seconds) for premium feel
    // This also gives time for the background data fetch to initiate
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // 2. Background Data Sync
  useEffect(() => {
    let isMounted = true;
    
    const syncData = async () => {
      const currentUser = getTelegramUser();
      if (!currentUser) return;

      try {
        // Fetch DB data in background (Balance, Config, etc.)
        const [existingUser, appConfig] = await Promise.all([
           getUserData(currentUser.id),
           getAppConfig()
        ]);
        
        if (isMounted) {
           setConfig(appConfig);
           if (existingUser) {
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

  // 3. Sync BottomNav with Route
  useEffect(() => {
    const path = location.pathname.replace('/', '');
    if (path === 'admin') return; 
    if (path === '') setActiveTab('home');
    else setActiveTab(path);
  }, [location]);

  // --- AUTO DISABLE MAINTENANCE LOGIC ---
  useEffect(() => {
    if (config.maintenanceMode && config.maintenanceEndTime) {
       const now = new Date().getTime();
       const end = new Date(config.maintenanceEndTime).getTime();
       if (now > end) {
          // Time passed, disable maintenance
          updateAppConfig({ ...config, maintenanceMode: false });
          setConfig(prev => ({ ...prev, maintenanceMode: false }));
       }
    }
  }, [config]);

  const handleBalanceUpdate = (newBalance: number) => {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = `#/${tab}`;
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  // Check Maintenance Mode
  const isAdminRoute = location.pathname.includes('/admin');
  if (config.maintenanceMode && !isAdminRoute) {
     return <MaintenanceScreen endTime={config.maintenanceEndTime} />;
  }

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
