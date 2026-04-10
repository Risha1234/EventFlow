import React, { useState, useEffect } from 'react';
import { NavLink, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Layers, 
  BarChart3, 
  Settings, 
  LogOut, 
  Zap, 
  Search, 
  Bell,
  Menu,
  X,
  ClipboardList,
  Sparkles
} from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client';
import DashboardOverviewPage from '../../pages/DashboardOverviewPage';
import EventsPage from '../../pages/EventsPage';
import RegistrationsPage from '../../pages/RegistrationsPage';
import WaitlistPage from '../../pages/WaitlistPage';
import EventDetails from '../../pages/EventDetails';
import AnalyticsPage from '../../pages/AnalyticsPage';
import SettingsPage from '../../pages/SettingsPage';
import AICopilot from '../AICopilot';

export default function DashboardLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("notifications") || "[]");
      return saved.map((n: any) => ({ ...n, time: new Date(n.time) }));
    } catch {
      return [];
    }
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const decoded: any = jwtDecode(token);
      setUserRole(decoded.role);
      setCurrentUserId(decoded.id);
    } catch (err) {
      console.error('Invalid token', err);
      localStorage.removeItem('token');
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId) return;
    
    const socket = io('http://localhost:5000');
    
    socket.on("waitlist_promoted", (data) => {
      if (data.userId === currentUserId) {
        setNotifications(prev => {
          const newNotif = {
            id: Date.now(),
            message: data.message,
            eventTitle: data.eventTitle,
            time: new Date()
          };
          const updated = [newNotif, ...prev].slice(0, 15);
          localStorage.setItem("notifications", JSON.stringify(updated));
          return updated;
        });
        setHasUnread(true);
        setToastMessage("🎉 You've been moved to confirmed registration!");
        setTimeout(() => setToastMessage(null), 4000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId]);

  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
    if (!isNotificationOpen) {
      setHasUnread(false);
    }
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    setHasUnread(false);
    localStorage.removeItem("notifications");
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  if (!userRole) return null; // Prevent flicker or crashes

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-200">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-white/5 transform transition-transform duration-300
        lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="h-20 flex items-center px-6 gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">EventFlow+</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 py-4">
            {userRole === 'admin' && (
              <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" end />
            )}
            
            <NavItem to="/dashboard/events" icon={<Calendar size={20} />} label={userRole === 'user' ? 'Browse Events' : 'Events'} />
            
            {(userRole === 'admin' || userRole === 'organizer') && (
              <NavItem to="/dashboard/registrations" icon={<Users size={20} />} label="Registrations" />
            )}

            {userRole === 'user' && (
              <>
                <NavItem to="/dashboard/registrations" icon={<ClipboardList size={20} />} label="My Registrations" />
                <NavItem to="/dashboard/waitlist" icon={<Layers size={20} />} label="My Waitlist" />
              </>
            )}

            {userRole === 'admin' && (
              <>
                <NavItem to="/dashboard/waitlist" icon={<Layers size={20} />} label="Waitlist" />
                <NavItem to="/dashboard/analytics" icon={<BarChart3 size={20} />} label="Analytics" />
              </>
            )}

            {(userRole === 'organizer' || userRole === 'admin') && (
              <button
                onClick={() => setIsAICopilotOpen(true)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all mt-2"
              >
                <Sparkles size={20} />
                <span className="font-medium text-sm">AI Copilot</span>
              </button>
            )}
            
            <NavItem to="/dashboard/settings" icon={<Settings size={20} />} label="Settings" />
          </nav>

          <div className="p-4 border-t border-white/5">
            <button 
              onClick={() => {
                localStorage.removeItem('token');
                navigate('/login');
              }}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-20 bg-zinc-950/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-zinc-400 hover:text-white" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5 w-80 focus-within:ring-2 focus-within:ring-primary-600/20 focus-within:border-primary-600/50 transition-all">
              <Search size={18} className="text-zinc-500" />
              <input type="text" placeholder="Search events..." className="bg-transparent border-none focus:outline-none text-sm w-full" />
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <button 
              onClick={handleNotificationClick}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all relative"
            >
              <Bell size={20} />
              {hasUnread && (
                <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary-600 rounded-full border-2 border-zinc-950"></div>
              )}
            </button>

            {isNotificationOpen && (
              <div className="absolute top-12 right-14 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold text-white text-sm">Notifications</h3>
                  {notifications.length > 0 && (
                    <button onClick={handleClearNotifications} className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto w-full">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-zinc-500 text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-zinc-800/50">
                      {notifications.map(notif => (
                        <div key={notif.id} className="p-4 hover:bg-white/5 transition-colors text-left space-y-1">
                          <p className="text-sm text-zinc-300"><span className="font-semibold text-white">{notif.eventTitle}</span>: {notif.message}</p>
                          <p className="text-xs text-zinc-500">{timeAgo(notif.time)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 border border-white/10" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <Routes>
                <Route index element={userRole === 'admin' ? <DashboardOverviewPage /> : <Navigate to="/dashboard/events" replace />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="registrations" element={<RegistrationsPage />} />
                <Route path="waitlist" element={<WaitlistPage />} />
                <Route path="analytics" element={userRole === 'admin' ? <AnalyticsPage /> : <Navigate to="/dashboard/events" replace />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<div className="text-white">Coming soon...</div>} />
            </Routes>
        </main>
      </div>

      {/* AI Copilot Panel */}
      <AICopilot isOpen={isAICopilotOpen} onClose={() => setIsAICopilotOpen(false)} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-zinc-900 border border-primary-500/50 shadow-lg shadow-primary-500/20 text-white px-6 py-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
           <span className="font-medium text-sm">{toastMessage}</span>
           <button onClick={() => setToastMessage(null)} className="text-zinc-400 hover:text-white ml-2">
             <X size={16} />
           </button>
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, end = false }: { to: string, icon: React.ReactNode, label: string, end?: boolean }) {
  return (
    <NavLink 
      to={to} 
      end={end}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
        ${isActive ? 'bg-primary-600/10 text-primary-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'}
      `}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </NavLink>
  );
}
