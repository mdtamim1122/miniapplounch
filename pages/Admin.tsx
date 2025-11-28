
import React, { useState, useEffect } from 'react';
import { User, AppConfig, Task, TaskType, PromoCode } from '../types';
import { 
  getAppConfig, updateAppConfig, getTotalUserCount, 
  addTask, deleteTask, getTasks, 
  getAllUsers, searchUsers, adminUpdateUser, toggleTaskStatus,
  createPromoCode, getPromoCodes, deletePromoCode
} from '../services/dbService';
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
  const [activeTab, setActiveTab] = useState<'settings' | 'tasks' | 'promos' | 'users'>('settings');

  // Task State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskReward, setNewTaskReward] = useState("500");
  const [newTaskUrl, setNewTaskUrl] = useState("");
  const [newTaskChatId, setNewTaskChatId] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>('web');
  const [newTaskMaxUsers, setNewTaskMaxUsers] = useState("0");

  // Promo Code State
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoReward, setNewPromoReward] = useState("1000");
  const [newPromoLimit, setNewPromoLimit] = useState("100");

  // User Manager State
  const [userList, setUserList] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Edit User Modal
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

  const loadInitialData = async () => {
    setLoading(true);
    const cfg = await getAppConfig();
    const count = await getTotalUserCount();
    const taskList = await getTasks();
    const promoList = await getPromoCodes();
    
    setConfig(cfg);
    setUserCount(count);
    setTasks(taskList);
    setPromos(promoList);
    setLoading(false);
  };

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
    setLoading(true);
    await updateAppConfig(config);
    onConfigUpdate(config);
    notificationFeedback('success');
    safeAlert("Settings Saved!");
    setLoading(false);
  };

  // --- TASK ACTIONS ---
  const handleCreateTask = async () => {
    if (!newTaskTitle || !newTaskReward || !newTaskUrl) {
      safeAlert("Fill all fields"); return;
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
    setNewTaskTitle(""); setNewTaskUrl("");
    notificationFeedback('success');
    setLoading(false);
  };

  const handleDeleteTask = async (id: string) => {
    if(!confirm("Delete?")) return;
    setLoading(true);
    await deleteTask(id);
    setTasks(tasks.filter(t => t.id !== id));
    setLoading(false);
  };

  const handleToggleTask = async (task: Task) => {
    const newState = !task.isActive;
    setTasks(tasks.map(t => t.id === task.id ? {...t, isActive: newState} : t));
    await toggleTaskStatus(task.id, newState);
  };

  // --- PROMO CODE ACTIONS ---
  const handleCreatePromo = async () => {
    if (!newPromoCode || !newPromoReward) {
        safeAlert("Code and Reward are required."); return;
    }
    const promo: PromoCode = {
        code: newPromoCode.trim(),
        reward: parseInt(newPromoReward),
        maxUsers: parseInt(newPromoLimit) || 0,
        usedCount: 0,
        isActive: true,
        createdAt: Date.now()
    };
    setLoading(true);
    try {
        await createPromoCode(promo);
        setPromos([...promos, promo]);
        setNewPromoCode("");
        notificationFeedback('success');
    } catch (e) {
        safeAlert("Error creating code (might already exist).");
    } finally {
        setLoading(false);
    }
  };

  const handleDeletePromo = async (code: string) => {
    if(!confirm("Delete this promo code?")) return;
    setLoading(true);
    await deletePromoCode(code);
    setPromos(promos.filter(p => p.code !== code));
    setLoading(false);
  };

  // --- USER ACTIONS ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) { setUsersLoaded(false); loadUsers(); return; }
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
      setUserList(userList.map(u => u.id === editingUser.id ? { ...u, ...editFormData } : u));
      setEditingUser(null);
      notificationFeedback('success');
    } catch (e) {
      safeAlert("Update failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-black p-6">
        <h2 className="text-2xl font-bold dark:text-white">Admin Login</h2>
        <form onSubmit={handleLogin} className="mt-4 w-full max-w-xs">
          <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN" className="w-full p-4 rounded-xl border mb-4"/>
          <button className="w-full bg-black text-white p-4 rounded-xl font-bold">Login</button>
        </form>
      </div>
    );
  }

  if (!config && loading) return <div className="p-10 text-center dark:text-white">Loading...</div>;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 bg-gray-50 dark:bg-black transition-colors duration-500">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">Admin Panel</h1>
        <button onClick={()=>navigate('/')} className="bg-white dark:bg-white/10 p-2 rounded-full text-black dark:text-white">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 p-1 bg-gray-200 dark:bg-white/10 rounded-xl overflow-x-auto">
        {['settings', 'tasks', 'promos', 'users'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase ${activeTab === tab ? 'bg-ios-primary text-white' : 'text-gray-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && config && (
        <div className="space-y-4">
           <div className="bg-blue-600 p-5 rounded-[24px] text-white shadow-lg">
              <div className="text-xs font-bold opacity-70">Total Users</div>
              <div className="text-3xl font-black">{userCount}</div>
           </div>
           
           <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-4">
              <h3 className="font-bold dark:text-white">Global Config</h3>
              
              <div>
                  <label className="text-xs font-bold text-gray-500">GigaPub Script ID</label>
                  <input value={config.gigaPubId || ""} onChange={(e) => setConfig({...config, gigaPubId: e.target.value})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-xs font-bold text-gray-500">Daily Ad Limit</label>
                    <input type="number" value={config.dailyAdLimit || 20} onChange={(e) => setConfig({...config, dailyAdLimit: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500">Ad Reward</label>
                    <input type="number" value={config.adReward} onChange={(e) => setConfig({...config, adReward: Number(e.target.value)})} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl mt-1 dark:text-white text-sm"/>
                 </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                 <div className="flex justify-between">
                    <span className="font-bold text-red-600 dark:text-red-400">Maintenance Mode</span>
                    <input type="checkbox" checked={config.maintenanceMode} onChange={(e) => setConfig({...config, maintenanceMode: e.target.checked})} className="w-5 h-5 accent-red-500"/>
                 </div>
                 {config.maintenanceMode && (
                    <input type="datetime-local" value={config.maintenanceEndTime || ""} onChange={(e) => setConfig({...config, maintenanceEndTime: e.target.value})} className="w-full bg-white dark:bg-black/30 p-2 rounded-lg mt-2 text-sm dark:text-white"/>
                 )}
              </div>

              <button onClick={handleSaveConfig} className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold">Save Changes</button>
           </div>
        </div>
      )}

      {/* TASKS TAB */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-3">
             <h3 className="font-bold dark:text-white">Create Task</h3>
             <input placeholder="Title" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"/>
             <input placeholder="URL" value={newTaskUrl} onChange={e=>setNewTaskUrl(e.target.value)} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"/>
             <div className="flex space-x-2">
                <input placeholder="Reward" type="number" value={newTaskReward} onChange={e=>setNewTaskReward(e.target.value)} className="w-1/3 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"/>
                <input placeholder="Max Users (0=inf)" type="number" value={newTaskMaxUsers} onChange={e=>setNewTaskMaxUsers(e.target.value)} className="w-1/3 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"/>
                <select value={newTaskType} onChange={e=>setNewTaskType(e.target.value as TaskType)} className="w-1/3 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white">
                   <option value="web">Web</option><option value="telegram">TG</option>
                </select>
             </div>
             {newTaskType === 'telegram' && <input placeholder="Chat ID" value={newTaskChatId} onChange={e=>setNewTaskChatId(e.target.value)} className="w-full bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl dark:text-white"/>}
             <button onClick={handleCreateTask} className="w-full bg-ios-primary text-white py-3 rounded-xl font-bold">Add Task</button>
          </div>
          
          <div className="space-y-3">
             {tasks.map(t => (
               <div key={t.id} className={`bg-white dark:bg-ios-dark-card p-4 rounded-xl shadow-sm flex justify-between ${!t.isActive && 'opacity-50'}`}>
                  <div>
                     <div className="font-bold dark:text-white">{t.title}</div>
                     <div className="text-xs text-gray-500">+{t.reward} | {t.completedCount || 0}/{t.maxUsers||'∞'}</div>
                  </div>
                  <div className="flex space-x-2">
                     <button onClick={()=>handleToggleTask(t)} className="text-xs bg-gray-200 px-2 rounded">{t.isActive?'ON':'OFF'}</button>
                     <button onClick={()=>handleDeleteTask(t.id)} className="text-xs bg-red-100 text-red-500 px-2 rounded">DEL</button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* PROMOS TAB */}
      {activeTab === 'promos' && (
        <div className="space-y-6">
           <div className="glass-panel bg-white dark:bg-ios-dark-card p-5 rounded-[24px] space-y-3">
              <h3 className="font-bold dark:text-white">Create Promo Code</h3>
              <input placeholder="Code (e.g. SUMMER24)" value={newPromoCode} onChange={e=>setNewPromoCode(e.target.value)} className="w-full bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white font-mono uppercase"/>
              <div className="flex space-x-2">
                 <input placeholder="Reward" type="number" value={newPromoReward} onChange={e=>setNewPromoReward(e.target.value)} className="w-1/2 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"/>
                 <input placeholder="Limit (0=inf)" type="number" value={newPromoLimit} onChange={e=>setNewPromoLimit(e.target.value)} className="w-1/2 bg-gray-100 dark:bg-black/30 p-3 rounded-xl dark:text-white"/>
              </div>
              <button onClick={handleCreatePromo} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold">Create Code</button>
           </div>

           <div className="space-y-3">
              {promos.length === 0 && <div className="text-center text-gray-500">No active codes</div>}
              {promos.map(p => (
                 <div key={p.code} className="bg-white dark:bg-ios-dark-card p-4 rounded-xl shadow-sm flex justify-between items-center">
                    <div>
                       <div className="font-mono font-bold text-lg dark:text-white">{p.code}</div>
                       <div className="text-xs text-gray-500">+{p.reward} Pts | Used: {p.usedCount}/{p.maxUsers||'∞'}</div>
                    </div>
                    <button onClick={()=>handleDeletePromo(p.code)} className="bg-red-50 text-red-500 p-2 rounded-lg text-xs font-bold">Delete</button>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
           <form onSubmit={handleSearch} className="flex space-x-2">
              <input placeholder="User ID / Username" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="flex-1 bg-white dark:bg-ios-dark-card p-3 rounded-xl dark:text-white"/>
              <button className="bg-ios-primary text-white px-4 rounded-xl font-bold">Find</button>
           </form>
           <div className="flex justify-between"><h3 className="font-bold dark:text-white">Users</h3><button onClick={loadUsers} className="text-blue-500 text-xs">Refresh</button></div>
           
           <div className="space-y-3">
              {userList.map(u => (
                 <div key={u.id} onClick={()=>openEditUser(u)} className="bg-white dark:bg-ios-dark-card p-3 rounded-xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center">
                       <img src={u.photoUrl||""} className="w-8 h-8 rounded-full bg-gray-200 mr-3"/>
                       <div>
                          <div className="font-bold text-sm dark:text-white">{u.firstName}</div>
                          <div className="text-[10px] text-gray-500">Bal: {u.balance} | Ref: {u.referralCount}</div>
                       </div>
                    </div>
                    <div className="text-xs text-gray-400">Edit</div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[32px] p-6 shadow-2xl">
              <h3 className="font-bold mb-4 dark:text-white text-center">Edit User</h3>
              <div className="space-y-3">
                 <input value={editFormData.firstName} onChange={e=>setEditFormData({...editFormData, firstName: e.target.value})} className="w-full p-3 bg-gray-100 dark:bg-black/30 rounded-xl dark:text-white" placeholder="Name"/>
                 <input type="number" value={editFormData.balance} onChange={e=>setEditFormData({...editFormData, balance: parseInt(e.target.value)||0})} className="w-full p-3 bg-gray-100 dark:bg-black/30 rounded-xl dark:text-white" placeholder="Balance"/>
                 <div className="flex items-center justify-between bg-gray-100 dark:bg-black/30 p-3 rounded-xl">
                    <span className="text-sm font-bold text-gray-500">Premium</span>
                    <input type="checkbox" checked={editFormData.isPremium} onChange={e=>setEditFormData({...editFormData, isPremium: e.target.checked})} className="w-5 h-5 accent-yellow-500"/>
                 </div>
              </div>
              <div className="flex space-x-3 mt-6">
                 <button onClick={()=>setEditingUser(null)} className="flex-1 py-3 bg-gray-200 dark:bg-white/10 rounded-xl text-gray-600 dark:text-white font-bold">Cancel</button>
                 <button onClick={saveEditUser} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold">Save</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
