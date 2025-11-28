
import React, { useState, useEffect } from 'react';
import { User, AppConfig, Task, TaskType } from '../types';
import { getAppConfig, updateAppConfig, getTotalUserCount, addTask, deleteTask, getTasks, getAllUsers, searchUsers, adminUpdateUser, toggleTaskStatus } from '../services/dbService';
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
  const [activeTab, setActiveTab] = useState<'settings' | 'tasks' | 'users'>('settings');

  // Task State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskReward, setNewTaskReward] = useState("500");
  const [newTaskUrl, setNewTaskUrl] = useState("");
  const [newTaskChatId, setNewTaskChatId] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>('web');
  const [newTaskMaxUsers, setNewTaskMaxUsers] = useState("0"); // 0 = unlimited

  // User Manager State
  const [userList, setUserList] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false); // Lazy load flag
  const [searchTerm, setSearchTerm] = useState("");
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    balance: 0,
    firstName: "",
    username: "",
    referralCount: 0,
    isPremium: false,
    photoUrl: ""
  });

  useEffect(() => {
    if (currentUser.id === ADMIN_ID) {
      setIsAuthenticated(true);
      loadInitialData();
    }
  }, [currentUser.id]);

  // Load ONLY lightweight data initially to prevent freezing
  const loadInitialData = async () => {
    setLoading(true);
    const cfg = await getAppConfig();
    const count = await getTotalUserCount();
    const taskList = await getTasks();
    
    setConfig(cfg);
    setUserCount(count);
    setTasks(taskList);
    setLoading(false);
  };

  // Lazy Load Users only when tab is active
  useEffect(() => {
    if (activeTab === 'users' && !usersLoaded) {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    const users = await getAllUsers();
    setUserList(users);
    setUsersLoaded(true);
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "2024" || currentUser.id === ADMIN_ID) {
      setIsAuthenticated(true);
      notificationFeedback('success');
      loadInitialData();
    } else {
      notificationFeedback('error');
      safeAlert("Incorrect Access PIN");
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    
    // Check if maintenance is on but no time set
    if (config.maintenanceMode && !config.maintenanceEndTime) {
      safeAlert("Please set an End Time for Maintenance Mode.");
      return;
    }

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
      createdAt: Date.now(),
      maxUsers: parseInt(newTaskMaxUsers) || 0,
      completedCount: 0,
      isActive: true
    };

    setLoading(true);
    await addTask(task);
    setTasks([task, ...tasks]); 
    setNewTaskTitle("");
    setNewTaskUrl("");
    setNewTaskChatId("");
    setNewTaskMaxUsers("0");
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

  const handleToggleTask = async (task: Task) => {
    const newState = !task.isActive;
    // Optimistic Update
    setTasks(tasks.map(t => t.id === task.id ? {...t, isActive: newState} : t));
    await toggleTaskStatus(task.id, newState);
  };

  // --- User Manager Functions ---

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setUsersLoaded(false); // Trigger reload
      loadUsers();
      return;
    }
    setLoading(true);
    const results = await searchUsers(searchTerm.trim());
    setUserList(results);
    setLoading(false);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
        balance: user.balance,
        firstName: user.firstName,
        username: user.username,
        referralCount: user.referralCount || 0,
        isPremium: user.isPremium || false,
        photoUrl: user.photoUrl || ""
    });
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    setLoading(true);
    try {
      await adminUpdateUser(editingUser.id, {
        balance: editFormData.balance,
        firstName: editFormData.firstName,
        username: editFormData.username,
        referralCount: editFormData.referralCount,
        isPremium: editFormData.isPremium,
        photoUrl: editFormData.photoUrl
      });
      
      // Update locally
      setUserList(userList.map(u => u.id === editingUser.id ? { 
          ...u, 
          balance: editFormData.balance, 
          firstName: editFormData.firstName, 
          username: editFormData.username,
          referralCount: editFormData.referralCount,
          isPremium: editFormData.isPremium,
          photoUrl: editFormData.photoUrl
      } : u));
      
      setEditingUser(null);
      notificationFeedback('success');
      safeAlert("User profile updated!");
    } catch (e) {
      safeAlert("Update failed.");
    } finally {
      setLoading(false);
    }
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

  if (!config && loading) return <div className="p-10 text-center dark:text-white">Loading Admin...</div>;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 animate-fade-in transition-colors duration-500 bg-gray-50 dark:bg-black">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold dark:text-white">Admin Panel</h1>
        <button onClick={() => navigate('/')} className="bg-white dark:bg-ios-dark-card p-3 rounded-full shadow-sm text-gray-900 dark:text-white">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 p-1 bg-gray-200 dark:bg-white/10 rounded-xl">
        {['settings', 'tasks', 'users'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${activeTab === tab ? 'bg-ios-primary text-white shadow-md' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && config && (
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-600 p-5 rounded-[24px] text-white shadow-lg flex flex-col justify-between">
              <div className="text-xs font-bold uppercase opacity-70">Total Users</div>
              <div className="text-3xl font-black">{userCount}</div>
            </div>
            
            <button 
              onClick={() => setActiveTab('users')}
              className="bg-purple-600 p-5 rounded-[24px] text-white shadow-lg active:scale-95 transition-transform text-left"
            >
              <div className="text-xs font-bold uppercase opacity-70">Quick Action</div>
              <div className="text-lg font-bold mt-1">Manage Users →</div>
            </button>
          </div>

          <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500">Mini App Direct Link</label>
              <input type="text" value={config.miniAppUrl || ""} onChange={(e) => setConfig({...config, miniAppUrl: e.target.value})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm font-mono" placeholder="https://t.me/YourBot/app" />
            </div>
            
            <div className="border-t border-b border-gray-100 dark:border-white/10 py-4 my-2">
               <h4 className="text-sm font-black dark:text-white mb-3">Ad Network Config</h4>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-xs font-bold text-gray-500">GigaPub Script ID</label>
                    <input type="text" value={config.gigaPubId || ""} onChange={(e) => setConfig({...config, gigaPubId: e.target.value})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm" placeholder="4473"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500">Daily Ad Limit</label>
                    <input type="number" value={config.dailyAdLimit || 20} onChange={(e) => setConfig({...config, dailyAdLimit: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm"/>
                 </div>
               </div>
               <div className="mt-3">
                  <label className="text-xs font-bold text-gray-500">Ad Reward Per View (GP)</label>
                  <input type="number" value={config.adReward} onChange={(e) => setConfig({...config, adReward: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white"/>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="text-xs font-bold text-gray-500">Normal Refer</label>
                  <input type="number" value={config.referralBonus} onChange={(e) => setConfig({...config, referralBonus: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white"/>
               </div>
               <div>
                  <label className="text-xs font-bold text-ios-gold">Premium Refer</label>
                  <input type="number" value={config.referralBonusPremium || 0} onChange={(e) => setConfig({...config, referralBonusPremium: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white border border-yellow-500/30"/>
               </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">Telegram Bot Token</label>
              <input type="text" placeholder="123456:ABC-DEF..." value={config.botToken || ""} onChange={(e) => setConfig({...config, botToken: e.target.value})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white font-mono text-sm"/>
            </div>
            
            {/* Maintenance Mode Settings */}
             <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 mt-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="dark:text-white font-bold flex items-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                        Maintenance Mode
                    </span>
                    <input 
                      type="checkbox" 
                      checked={config.maintenanceMode} 
                      onChange={(e) => setConfig({...config, maintenanceMode: e.target.checked})} 
                      className="w-6 h-6 accent-red-500"
                    />
                </div>
                {config.maintenanceMode && (
                    <div className="mt-2 animate-fade-in">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Ends At (Date & Time)</label>
                        <input 
                          type="datetime-local" 
                          value={config.maintenanceEndTime || ""} 
                          onChange={(e) => setConfig({...config, maintenanceEndTime: e.target.value})}
                          className="w-full bg-white dark:bg-black/30 p-3 rounded-lg mt-1 dark:text-white text-sm"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">App will auto-resume after this time.</p>
                    </div>
                )}
            </div>

            <button onClick={handleSaveConfig} className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold mt-2">Save Settings</button>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-4 border border-gray-100 dark:border-white/10">
            <h3 className="font-bold dark:text-white border-b dark:border-white/10 pb-2">Create New Task</h3>
            <input 
              placeholder="Task Title (e.g. Join Channel)" 
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
            />
            <div className="flex space-x-2">
               <div className="w-1/3">
                 <label className="text-[10px] text-gray-500 font-bold pl-1">Reward</label>
                 <input 
                  type="number"
                  placeholder="500" 
                  value={newTaskReward}
                  onChange={e => setNewTaskReward(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
                />
               </div>
               <div className="w-1/3">
                  <label className="text-[10px] text-gray-500 font-bold pl-1">Max Users</label>
                  <input 
                    type="number"
                    placeholder="0 = ∞" 
                    value={newTaskMaxUsers}
                    onChange={e => setNewTaskMaxUsers(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
                  />
               </div>
               <div className="w-1/3">
                  <label className="text-[10px] text-gray-500 font-bold pl-1">Type</label>
                  <select 
                    value={newTaskType}
                    onChange={e => setNewTaskType(e.target.value as TaskType)}
                    className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
                  >
                    <option value="web">Web</option>
                    <option value="telegram">TG</option>
                  </select>
               </div>
            </div>
            <input 
              placeholder="URL (https://t.me/...)" 
              value={newTaskUrl}
              onChange={e => setNewTaskUrl(e.target.value)}
              className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"
            />
            {newTaskType === 'telegram' && (
              <input 
                placeholder="Channel ID (e.g. -100123456789)" 
                value={newTaskChatId}
                onChange={e => setNewTaskChatId(e.target.value)}
                className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-3 rounded-xl dark:text-white font-mono text-sm"
              />
            )}
            <button onClick={handleCreateTask} disabled={loading} className="w-full bg-ios-primary text-white py-3 rounded-xl font-bold">
              {loading ? 'Processing...' : 'Add Task'}
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map(task => {
                const percent = (task.maxUsers && task.maxUsers > 0) 
                   ? Math.round(((task.completedCount || 0) / task.maxUsers) * 100) 
                   : 0;
                
                return (
                  <div key={task.id} className={`bg-white dark:bg-ios-dark-card p-4 rounded-[20px] shadow-sm ${task.isActive === false ? 'opacity-60 grayscale' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="overflow-hidden flex-1 mr-2">
                        <div className="font-bold dark:text-white truncate">{task.title}</div>
                        <div className="text-xs text-gray-500 flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${task.type === 'telegram' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {task.type.toUpperCase()}
                          </span>
                          <span>+{task.reward} GP</span>
                        </div>
                        {/* Progress Bar for Limited Tasks */}
                        {task.maxUsers && task.maxUsers > 0 ? (
                           <div className="mt-2 w-full max-w-[150px]">
                              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                 <span>{task.completedCount || 0} / {task.maxUsers}</span>
                                 <span>{percent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                 <div className="h-full bg-ios-primary" style={{ width: `${percent}%` }}></div>
                              </div>
                           </div>
                        ) : (
                           <div className="text-[10px] text-gray-400 mt-1">Unlimited Users</div>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                         <button onClick={() => handleDeleteTask(task.id)} className="p-2 bg-red-50 text-red-500 rounded-lg text-xs font-bold">
                           Delete
                         </button>
                         <button onClick={() => handleToggleTask(task)} className={`p-2 rounded-lg text-xs font-bold ${task.isActive !== false ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            {task.isActive !== false ? 'Active' : 'Inactive'}
                         </button>
                      </div>
                    </div>
                  </div>
                );
            })}
            {tasks.length === 0 && <p className="text-center text-gray-400">No tasks created yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
           {/* Search Bar */}
           <form onSubmit={handleSearch} className="flex space-x-2">
             <input 
               placeholder="Search by ID or Username..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="flex-1 bg-white dark:bg-ios-dark-card p-3 rounded-xl dark:text-white border border-gray-200 dark:border-white/10"
             />
             <button type="submit" className="bg-ios-primary text-white px-4 rounded-xl font-bold">Search</button>
           </form>
           
           <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold dark:text-white">Recent Users {loading && '(Loading...)'}</h3>
              <button onClick={loadUsers} className="text-xs text-ios-primary font-bold">Refresh List</button>
           </div>

           <div className="space-y-3">
              {userList.length === 0 && !loading && <div className="text-center text-gray-400 py-10">No users found.</div>}
              {userList.map(u => (
                <div key={u.id} onClick={() => openEditUser(u)} className="bg-white dark:bg-ios-dark-card p-4 rounded-[20px] flex items-center shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
                   <img src={u.photoUrl || "https://picsum.photos/100"} className="w-10 h-10 rounded-full mr-3 bg-gray-200" alt="u"/>
                   <div className="flex-1 overflow-hidden">
                      <div className="font-bold dark:text-white truncate">{u.firstName} <span className="text-xs text-gray-400 font-normal">(@{u.username})</span></div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">ID: {u.id}</div>
                      <div className="flex space-x-2 mt-1">
                        {u.isPremium && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-[10px] rounded font-bold">PREMIUM</span>}
                        <span className="text-[10px] bg-gray-100 dark:bg-white/10 px-2 rounded">Refs: {u.referralCount || 0}</span>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="font-bold text-ios-primary dark:text-ios-gold">{u.balance.toLocaleString()}</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Enhanced Edit User Modal (A to Z Edit) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border-t sm:border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 dark:text-white text-center">Edit User Profile</h3>
            
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-gray-500 font-bold ml-2">User ID (ReadOnly)</label>
                  <div className="bg-gray-100 dark:bg-black/30 p-3 rounded-xl text-xs font-mono dark:text-gray-400">{editingUser.id}</div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-xs text-gray-500 font-bold ml-2">First Name</label>
                    <input value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-3 rounded-xl dark:text-white"/>
                 </div>
                 <div>
                    <label className="text-xs text-gray-500 font-bold ml-2">Username</label>
                    <input value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-3 rounded-xl dark:text-white"/>
                 </div>
               </div>

               <div>
                  <label className="text-xs text-gray-500 font-bold ml-2">Balance (GP)</label>
                  <input type="number" value={editFormData.balance} onChange={e => setEditFormData({...editFormData, balance: parseInt(e.target.value) || 0})} className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-3 rounded-xl dark:text-white font-mono text-lg font-bold text-center"/>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-xs text-gray-500 font-bold ml-2">Referrals Count</label>
                    <input type="number" value={editFormData.referralCount} onChange={e => setEditFormData({...editFormData, referralCount: parseInt(e.target.value) || 0})} className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-3 rounded-xl dark:text-white text-center"/>
                 </div>
                 <div className="flex flex-col justify-center items-center bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10">
                    <label className="text-xs text-gray-500 font-bold mb-1">Premium Status</label>
                    <div className="flex items-center space-x-2">
                       <input 
                         type="checkbox" 
                         checked={editFormData.isPremium} 
                         onChange={e => setEditFormData({...editFormData, isPremium: e.target.checked})} 
                         className="w-6 h-6 accent-yellow-500"
                       />
                       <span className={`text-xs font-bold ${editFormData.isPremium ? 'text-yellow-500' : 'text-gray-400'}`}>
                         {editFormData.isPremium ? 'YES' : 'NO'}
                       </span>
                    </div>
                 </div>
               </div>

               <div>
                  <label className="text-xs text-gray-500 font-bold ml-2">Photo URL</label>
                  <input value={editFormData.photoUrl} onChange={e => setEditFormData({...editFormData, photoUrl: e.target.value})} className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 p-3 rounded-xl dark:text-white text-xs"/>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
               <button onClick={() => setEditingUser(null)} className="py-3 rounded-xl font-bold bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white">Cancel</button>
               <button onClick={saveEditUser} className="py-3 rounded-xl font-bold bg-ios-primary text-white shadow-lg shadow-blue-500/30">Save Changes</button>
            </div>
            <div className="h-4 sm:hidden"></div> {/* Spacer for mobile safarea */}
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
