
import React, { useState, useEffect } from 'react';
import { User, AppConfig, Task, TaskType } from '../types';
import { getAppConfig, updateAppConfig, getTotalUserCount, addTask, deleteTask, getTasks } from '../services/dbService';
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
  const [activeTab, setActiveTab] = useState<'settings' | 'tasks'>('settings');

  // Task State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskReward, setNewTaskReward] = useState("500");
  const [newTaskUrl, setNewTaskUrl] = useState("");
  const [newTaskChatId, setNewTaskChatId] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>('web');

  useEffect(() => {
    if (currentUser.id === ADMIN_ID) {
      setIsAuthenticated(true);
      loadData();
    }
  }, [currentUser.id]);

  const loadData = async () => {
    setLoading(true);
    const cfg = await getAppConfig();
    const count = await getTotalUserCount();
    const taskList = await getTasks();
    setConfig(cfg);
    setUserCount(count);
    setTasks(taskList);
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

  const handleSaveConfig = async () => {
    if (!config) return;
    setLoading(true);
    await updateAppConfig(config);
    onConfigUpdate(config);
    notificationFeedback('success');
    safeAlert("Settings Saved!");
    setLoading(false);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle || !newTaskReward || !newTaskUrl) {
      safeAlert("Please fill all fields");
      return;
    }

    if (newTaskType === 'telegram' && !newTaskChatId) {
      safeAlert("Telegram Tasks require a Channel Username or ID");
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      reward: parseInt(newTaskReward),
      url: newTaskUrl,
      type: newTaskType,
      chatId: newTaskChatId,
      createdAt: Date.now()
    };

    setLoading(true);
    await addTask(task);
    setTasks([task, ...tasks]); // Optimistic update
    setNewTaskTitle("");
    setNewTaskUrl("");
    setNewTaskChatId("");
    notificationFeedback('success');
    setLoading(false);
  };

  const handleDeleteTask = async (id: string) => {
    if(!confirm("Delete this task?")) return;
    setLoading(true);
    await deleteTask(id);
    setTasks(tasks.filter(t => t.id !== id));
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-black transition-colors duration-500">
        <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Admin Access</h2>
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4 mt-4">
          <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full bg-white dark:bg-ios-dark-card border border-gray-200 dark:border-white/10 rounded-[18px] px-4 py-4 text-center text-lg text-gray-900 dark:text-white focus:outline-none"
          />
          <button type="submit" className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-[18px]">Verify</button>
        </form>
      </div>
    );
  }

  if (!config) return <div className="p-10 text-center dark:text-white">Loading...</div>;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 animate-fade-in transition-colors duration-500 bg-gray-50 dark:bg-black">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold dark:text-white">Admin Panel</h1>
        <button onClick={() => navigate('/')} className="bg-white dark:bg-ios-dark-card p-3 rounded-full shadow-sm text-gray-900 dark:text-white">✕</button>
      </div>

      <div className="flex space-x-2 mb-6">
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'settings' ? 'bg-ios-primary text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}
        >
          Settings
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'tasks' ? 'bg-ios-primary text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'}`}
        >
          Manage Tasks
        </button>
      </div>

      {activeTab === 'settings' ? (
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-600 p-5 rounded-[24px] text-white shadow-lg">
              <div className="text-xs font-bold uppercase opacity-70">Users</div>
              <div className="text-3xl font-black">{userCount}</div>
            </div>
            <div className="bg-purple-600 p-5 rounded-[24px] text-white shadow-lg">
              <div className="text-xs font-bold uppercase opacity-70">Status</div>
              <div className="text-3xl font-black">OK</div>
            </div>
          </div>

          <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500">Mini App Direct Link (e.g. t.me/bot/app)</label>
              <input type="text" value={config.miniAppUrl || ""} onChange={(e) => setConfig({...config, miniAppUrl: e.target.value})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm font-mono" placeholder="https://t.me/YourBot/app" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">Ad Reward</label>
              <input type="number" value={config.adReward} onChange={(e) => setConfig({...config, adReward: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">Referral Bonus</label>
              <input type="number" value={config.referralBonus} onChange={(e) => setConfig({...config, referralBonus: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white"/>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">Telegram Bot Token (for task check)</label>
              <input type="text" placeholder="123456:ABC-DEF..." value={config.botToken || ""} onChange={(e) => setConfig({...config, botToken: e.target.value})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white font-mono text-sm"/>
              <p className="text-[10px] text-red-400 mt-1">Make sure the Bot is Admin in your channels.</p>
            </div>
             <div className="flex items-center justify-between pt-2">
                <span className="dark:text-white font-bold">Maintenance Mode</span>
                <input type="checkbox" checked={config.maintenanceMode} onChange={(e) => setConfig({...config, maintenanceMode: e.target.checked})} className="w-6 h-6"/>
            </div>
            <button onClick={handleSaveConfig} className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold mt-2">Save Settings</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Create Task */}
          <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-4 border border-gray-100 dark:border-white/10">
            <h3 className="font-bold dark:text-white border-b dark:border-white/10 pb-2">Create New Task</h3>
            <input 
              placeholder="Task Title (e.g. Join Channel)" 
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
            />
            <div className="flex space-x-2">
               <input 
                type="number"
                placeholder="Reward" 
                value={newTaskReward}
                onChange={e => setNewTaskReward(e.target.value)}
                className="w-1/3 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
              />
              <select 
                value={newTaskType}
                onChange={e => setNewTaskType(e.target.value as TaskType)}
                className="w-2/3 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
              >
                <option value="web">Web Visit (Timer)</option>
                <option value="telegram">Telegram (Check)</option>
              </select>
            </div>
            <input 
              placeholder="Link URL (https://t.me/...)" 
              value={newTaskUrl}
              onChange={e => setNewTaskUrl(e.target.value)}
              className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
            />
            {newTaskType === 'telegram' && (
              <input 
                placeholder="Channel Username (@name) or ID" 
                value={newTaskChatId}
                onChange={e => setNewTaskChatId(e.target.value)}
                className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-3 rounded-xl dark:text-white font-mono text-sm"
              />
            )}
            <button onClick={handleCreateTask} disabled={loading} className="w-full bg-ios-primary text-white py-3 rounded-xl font-bold">
              {loading ? 'Processing...' : 'Add Task'}
            </button>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="bg-white dark:bg-ios-dark-card p-4 rounded-[20px] flex justify-between items-center shadow-sm">
                <div className="overflow-hidden">
                  <div className="font-bold dark:text-white truncate">{task.title}</div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${task.type === 'telegram' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {task.type.toUpperCase()}
                    </span>
                    <span>+{task.reward} GP</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{task.url}</div>
                  {task.chatId && <div className="text-[9px] text-blue-400 font-mono">ID: {task.chatId}</div>}
                </div>
                <button onClick={() => handleDeleteTask(task.id)} className="p-2 bg-red-50 text-red-500 rounded-lg">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;