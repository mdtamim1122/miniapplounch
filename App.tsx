import React, { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Referral from './pages/Referral';
import Earn from './pages/Earn';
import BottomNav from './components/BottomNav';
import { initTelegram, getTelegramUser } from './services/telegramService';
import { getUserData, createUser } from './services/dbService';
import { User } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize App
  useEffect(() => {
    const init = async () => {
      initTelegram();
      
      const tgUser = getTelegramUser();
      
      if (tgUser) {
        // Try to fetch existing user from "DB"
        const existingUser = await getUserData(tgUser.id);
        
        if (existingUser) {
          setUser(existingUser);
        } else {
          // New user registration
          const newUser = await createUser(tgUser);
          setUser(newUser);
        }
      }
      setLoading(false);
    };
    
    init();
  }, []);

  const handleBalanceUpdate = (newBalance: number) => {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-ios-gold border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-ios-subtext font-medium text-sm animate-pulse">Loading App...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center text-white bg-black p-4 text-center">
        <p>Could not authenticate user. Please open in Telegram.</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home user={user} />;
      case 'leaderboard':
        return <Leaderboard currentUser={user} />;
      case 'referral':
        return <Referral user={user} />;
      case 'earn':
        return <Earn user={user} onUpdate={handleBalanceUpdate} />;
      default:
        return <Home user={user} />;
    }
  };

  return (
    <HashRouter>
      <div className="bg-ios-bg min-h-screen text-ios-text font-sans selection:bg-ios-gold selection:text-black">
        {/* Main Content Area */}
        <main className="w-full max-w-md mx-auto min-h-screen relative">
          {renderContent()}
        </main>

        {/* Navigation */}
        <BottomNav currentTab={activeTab} setTab={setActiveTab} />
      </div>
    </HashRouter>
  );
};

export default App;
