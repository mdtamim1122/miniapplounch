import React, { useEffect, useState } from 'react';
import { User, LeaderboardEntry } from '../types';
import { getLeaderboard } from '../services/dbService';

interface LeaderboardProps {
  currentUser: User;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ currentUser }) => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getLeaderboard();
        setLeaders(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="flex flex-col h-screen pt-6 pb-24 px-4 animate-slide-up transition-colors duration-500">
      <h2 className="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white font-display">Leaderboard</h2>
      <p className="text-center text-ios-subtext text-sm mb-6 font-medium">Top 100 Players</p>

      {/* Current User Rank Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-900/80 dark:to-indigo-900/80 glass-panel rounded-[24px] p-4 mb-6 flex items-center shadow-lg shadow-blue-500/20 sticky top-0 z-20 border border-white/10">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xs font-black text-white mr-3 border border-white/20">
          YOU
        </div>
        <img src={currentUser.photoUrl || "https://picsum.photos/200"} className="w-12 h-12 rounded-full border-2 border-white/30 mr-3 shadow-md" alt="me" />
        <div className="flex-1">
          <div className="font-bold text-white text-lg leading-tight">{currentUser.username}</div>
          <div className="text-xs font-bold text-blue-100 opacity-80">{currentUser.balance.toLocaleString()} GP</div>
        </div>
        <div className="text-xl font-black text-white/80">#9K</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4 no-scrollbar">
        {loading ? (
          <div className="flex flex-col space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-white/5 rounded-[20px] animate-pulse"></div>
            ))}
          </div>
        ) : (
          leaders.map((entry, index) => {
            const isTop3 = index < 3;
            
            // Medals for top 3
            let RankIcon = <div className="w-8 font-black text-lg text-center mr-3 text-gray-400 font-display">{index + 1}</div>;
            if (index === 0) RankIcon = <div className="text-3xl mr-3 filter drop-shadow-md">🥇</div>;
            if (index === 1) RankIcon = <div className="text-3xl mr-3 filter drop-shadow-md">🥈</div>;
            if (index === 2) RankIcon = <div className="text-3xl mr-3 filter drop-shadow-md">🥉</div>;

            return (
              <div key={entry.id} className={`glass-panel bg-white/70 dark:bg-ios-dark-card/60 border border-ios-border dark:border-white/5 rounded-[24px] p-3 flex items-center transform transition-all active:scale-[0.98] ${isTop3 ? 'shadow-md dark:shadow-glow border-yellow-400/20' : 'shadow-sm'}`}>
                {RankIcon}
                <img src={entry.photoUrl} className="w-12 h-12 rounded-full mr-3 bg-gray-300 dark:bg-gray-800 object-cover shadow-sm" alt="user" />
                <div className="flex-1">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">{entry.username}</div>
                </div>
                <div className="font-bold text-ios-primary dark:text-ios-gold text-sm bg-blue-50 dark:bg-yellow-500/10 px-3 py-1 rounded-full">
                  {entry.balance.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
