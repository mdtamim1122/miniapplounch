
import React, { useState, useEffect } from 'react';
import { User, AppConfig, Task } from '../types';
import { updateUserBalance, getTasks, claimTask, trackAdWatch } from '../services/dbService';
import { hapticFeedback, notificationFeedback, safeAlert, openLink, checkChannelMembership } from '../services/telegramService';
import { useTheme } from '../contexts/ThemeContext';

interface EarnProps {
  user: User;
  onUpdate: (newBalance: number) => void;
  config: AppConfig;
}

const Earn: React.FC<EarnProps> = ({ user, onUpdate, config }) => {
  const [adLoading, setAdLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [activeTimerTask, setActiveTimerTask] = useState<string | null>(null); // Task ID currently waiting
  const [timeLeft, setTimeLeft] = useState(0);
  const [checkingTask, setCheckingTask] = useState<string | null>(null); // Task ID currently verifying
  
  // Track which tasks have been "started" (link clicked) to show Claim/Check button
  const [startedTasks, setStartedTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Dynamic Script Injection for GigaPub
    const scriptId = 'gigapub-ad-script';
    if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        // Use configured ID or default
        const gigaId = config.gigaPubId || '4473'; 
        script.src = `https://ad.gigapub.tech/script?id=${gigaId}`;
        document.head.appendChild(script);
    }
  }, [config.gigaPubId]);

  useEffect(() => {
    // Load tasks and completed status
    const load = async () => {
      const allTasks = await getTasks();
      // Only show tasks that are Active (admin toggle) AND not completed (optional, or move to bottom)
      // We will show completed at bottom, but HIDE inactive tasks completely.
      setTasks(allTasks.filter(t => t.isActive !== false));
      setCompletedTaskIds(user.completedTasks || []);
    };
    load();
  }, [user.completedTasks]);

  // Timer Effect for Web Tasks
  useEffect(() => {
    if (activeTimerTask && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTimerTask, timeLeft]);

  const watchAd = async () => {
    if (adLoading) return;
    if (config.maintenanceMode) {
        safeAlert("Maintenance Mode Active");
        return;
    }

    // Check Daily Limit
    const canWatch = await trackAdWatch(user.id);
    if (!canWatch.allowed) {
        safeAlert(canWatch.message || "Daily ad limit reached.");
        return;
    }

    hapticFeedback('medium');
    setAdLoading(true);
    try {
      if (typeof window.showGiga !== 'function') throw new Error("Ad service not ready");
      await window.showGiga();
      const reward = config.adReward;
      const newBal = await updateUserBalance(user.id, reward);
      onUpdate(newBal);
      notificationFeedback('success');
      safeAlert(`You earned ${reward} GP!`);
    } catch (e) {
      notificationFeedback('error');
    } finally {
      setAdLoading(false);
    }
  };

  const handleTaskAction = async (task: Task) => {
    // If already completed, do nothing
    if (completedTaskIds.includes(task.id)) return;

    if (task.type === 'web') {
      // Step 1: Open Link & Start Timer
      if (!startedTasks[task.id]) {
        openLink(task.url);
        setStartedTasks(prev => ({ ...prev, [task.id]: true }));
        setActiveTimerTask(task.id);
        setTimeLeft(10); // 10 Seconds Wait
      } else {
        // Step 2: Claim if timer done
        if (timeLeft > 0) {
          safeAlert(`Please wait ${timeLeft} seconds...`);
          return;
        }
        await doClaim(task);
      }
    } else if (task.type === 'telegram') {
       // Step 1: Join (Open Link)
       if (!startedTasks[task.id]) {
         openLink(task.url);
         setStartedTasks(prev => ({ ...prev, [task.id]: true }));
       } else {
         // Step 2: Check Membership with Real API
         setCheckingTask(task.id);
         
         if (!config.botToken || !task.chatId) {
            safeAlert("Configuration Error: Admin has not set Bot Token or Channel ID.");
            setCheckingTask(null);
            return;
         }

         const isMember = await checkChannelMembership(config.botToken, task.chatId, user.id);
         
         if (isMember) {
           await doClaim(task);
         } else {
           notificationFeedback('error');
           safeAlert("You haven't joined the channel yet! Please join and try again.");
         }
         setCheckingTask(null);
       }
    }
  };

  const doClaim = async (task: Task) => {
    const res = await claimTask(user.id, task);
    if (res.success && res.newBalance) {
      onUpdate(res.newBalance);
      setCompletedTaskIds(prev => [...prev, task.id]);
      notificationFeedback('success');
      hapticFeedback('heavy');
      // Reset states
      setActiveTimerTask(null);
      setStartedTasks(prev => {
        const copy = {...prev};
        delete copy[task.id];
        return copy;
      });
    } else {
      safeAlert("Task unavailable or already claimed.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-6 pb-24 px-4 animate-slide-up transition-colors duration-500">
      <h2 className="text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white font-display">Earn Coins</h2>

      {/* Video Ad Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-purple-900 dark:to-indigo-900 rounded-[30px] p-6 mb-8 shadow-xl relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl">🎬</div>
            <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">Recommended</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">Watch Ads</h3>
          <p className="text-sm text-indigo-100 mb-6 font-medium opacity-90">Daily Limit: {config.dailyAdLimit || 20}</p>
          <button 
            onClick={watchAd}
            disabled={adLoading || config.maintenanceMode}
            className="w-full bg-white text-indigo-600 font-bold py-3.5 px-6 rounded-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-70 disabled:scale-100"
          >
            {adLoading ? 'Loading...' : `Watch (+${config.adReward} GP)`}
          </button>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200 px-1">Active Tasks</h3>
      
      <div className="space-y-4 pb-4">
        {tasks.map((task) => {
          const isCompleted = completedTaskIds.includes(task.id);
          const isStarted = startedTasks[task.id];
          const isTimerRunning = activeTimerTask === task.id && timeLeft > 0;
          const isChecking = checkingTask === task.id;

          if (isCompleted) return null; // Hide completed tasks

          return (
            <div key={task.id} className="glass-panel bg-white/70 dark:bg-ios-dark-card/60 border border-ios-border dark:border-white/5 rounded-[24px] p-4 flex items-center justify-between shadow-sm">
               <div className="flex items-center overflow-hidden mr-3">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mr-4 shrink-0 ${task.type === 'telegram' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-500' : 'bg-green-100 dark:bg-green-500/20 text-green-500'}`}>
                   {task.type === 'telegram' ? '✈️' : '🌐'}
                 </div>
                 <div className="min-w-0">
                   <div className="font-bold text-gray-900 dark:text-white text-base truncate">{task.title}</div>
                   <div className="text-xs font-semibold text-ios-primary dark:text-ios-gold">+{task.reward} GP</div>
                   {task.maxUsers && task.maxUsers > 0 && (
                      <div className="text-[10px] text-gray-400 mt-0.5">Limited: {task.completedCount || 0}/{task.maxUsers}</div>
                   )}
                 </div>
               </div>
               
               <button 
                 onClick={() => handleTaskAction(task)}
                 disabled={isChecking || isTimerRunning}
                 className={`px-5 py-2 rounded-full text-xs font-bold transition-all min-w-[80px] flex justify-center
                   ${isTimerRunning ? 'bg-gray-300 text-gray-600' : 
                     isStarted 
                       ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                       : 'bg-gray-900 dark:bg-white text-white dark:text-black'
                   }
                 `}
               >
                 {isChecking ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                 ) : isTimerRunning ? (
                   `${timeLeft}s`
                 ) : isStarted ? (
                   task.type === 'telegram' ? 'Check' : 'Claim'
                 ) : (
                   task.type === 'telegram' ? 'Join' : 'Start'
                 )}
               </button>
            </div>
          );
        })}

        {tasks.length === 0 && <div className="text-center text-gray-400 py-10">No tasks available right now.</div>}
        {tasks.length > 0 && tasks.every(t => completedTaskIds.includes(t.id)) && (
             <div className="text-center text-green-500 font-bold py-10">All tasks completed! 🎉</div>
        )}
      </div>
    </div>
  );
};

export default Earn;
