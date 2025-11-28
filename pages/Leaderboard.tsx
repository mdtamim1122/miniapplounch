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
        // Insert current user into the list logically if they were part of the backend sort
        // For demo, we just prepend the user at the top as "My Rank"
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
    <div className="flex flex-col h-screen pt-6 pb-24 px-4 animate-slide-up">
      <h2 className="text-3xl font-bold text-center mb-2">Leaderboard</h2>
      <p className="text-center text-ios-subtext text-sm mb-6">Top 100 Players</p>

      {/* Current User Rank Card */}
      <div className="bg-gradient-to-r from-blue-900/60 to-purple-900/60 border border-white/20 rounded-2xl p-4 mb-6 flex items-center shadow-lg sticky top-0 z-20 backdrop-blur-xl">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold mr-3">
          YOU
        </div>
        <img src={currentUser.photoUrl || "https://picsum.photos/200"} className="w-10 h-10 rounded-full border border-white/30 mr-3" alt="me" />
        <div className="flex-1">
          <div className="font-bold text-white">{currentUser.username}</div>
          <div className="text-xs text-blue-200">{currentUser.balance.toLocaleString()} GP</div>
        </div>
        <div className="text-lg font-black text-white/50">#9K</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4">
        {loading ? (
          <div className="flex flex-col space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-ios-card/50 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          leaders.map((entry, index) => {
            const isTop3 = index < 3;
            let rankColor = 'text-gray-500';
            if (index === 0) rankColor = 'text-yellow-400';
            if (index === 1) rankColor = 'text-gray-300';
            if (index === 2) rankColor = 'text-orange-400';

            return (
              <div key={entry.id} className="bg-ios-card border border-white/5 rounded-xl p-3 flex items-center transform transition-transform active:scale-[0.98]">
                <div className={`w-8 font-black text-lg text-center mr-3 ${rankColor}`}>
                  {index + 1}
                </div>
                <img src={entry.photoUrl} className="w-10 h-10 rounded-full mr-3 bg-gray-800 object-cover" alt="user" />
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">{entry.username}</div>
                </div>
                <div className="font-medium text-ios-gold text-sm">
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
