import API_URL from "../utils/api";
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Layers, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

const data = [
  { name: 'Mon', regs: 400 },
  { name: 'Tue', regs: 300 },
  { name: 'Wed', regs: 600 },
  { name: 'Thu', regs: 800 },
  { name: 'Fri', regs: 500 },
  { name: 'Sat', regs: 900 },
  { name: 'Sun', regs: 1100 },
];

export default function DashboardOverview() {
  const [counts, setCounts] = useState({ events: 0, users: 0 });
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let extractedName = '';
    
    // Check local storage first
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        extractedName = userObj?.name || userObj?.username || '';
      }
    } catch (e) {}

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setUserRole(decoded.role);
        
        if (!extractedName) {
          extractedName = decoded.name || decoded.username || (decoded.email ? decoded.email.split('@')[0] : '');
        }
      } catch (e) {
        console.error('Failed to decode token');
      }
    }
    
    setUserName(extractedName);
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [eventsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/events`, { headers }),
        fetch(`${API_URL}/users`, { headers })
      ]);
      const eventsData = await eventsRes.json();
      const usersData = await usersRes.json();
      setCounts({
        events: eventsData.length,
        users: usersData.length
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };


  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-zinc-500 mt-1">Ready to manage your upcoming events?</p>
        </div>
        <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 transition-all">Last 7 days</button>
            {(userRole === 'organizer' || userRole === 'admin') && (
              <button className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500 transition-all shadow-lg shadow-primary-900/20">Create Event</button>
            )}
        </div>
      </div>

      {/* KPI Cards - Hidden for regular users */}
      {userRole !== 'user' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard title="Total Events" value={counts.events.toString()} trend="+2" icon={<Calendar />} />
          <KPICard title="Total Platform Users" value={counts.users.toString()} trend="+12%" icon={<Users />} />
          <KPICard title="Waitlisted Users" value="84" trend="-5%" trendColor="text-green-500" icon={<Layers />} />
          <KPICard title="Fill Rate %" value="92.4%" trend="+4.1%" icon={<TrendingUp />} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Chart - Hidden for regular users */}
        {userRole !== 'user' ? (
          <div className="lg:col-span-8 bg-zinc-950/50 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg">Registrations over time</h3>
              <button className="text-zinc-500 hover:text-white"><MoreHorizontal size={20} /></button>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="regs" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRegs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-zinc-950/50 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary-600/10 flex items-center justify-center text-primary-500">
                <Zap size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome back{userName ? `, ${userName}` : ''}!</h2>
              <p className="text-zinc-500 max-w-sm">Browse the latest events and manage your registrations from the sidebar.</p>
              <button 
                onClick={() => navigate('/dashboard/events')}
                className="px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-500 transition-all"
              >
                Explore Events
              </button>
          </div>
        )}

        {/* Live Activity */}
        <div className="lg:col-span-4 bg-zinc-950/50 border border-white/5 rounded-3xl p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-lg">{userRole === 'user' ? 'My Activity' : 'Live Activity'}</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary-600/10 text-primary-500 text-[10px] font-bold uppercase tracking-wider">Live</span>
            </div>
            <div className="space-y-6 flex-1">
                <ActivityItem user="Sarah K." action="joined" target="Summer Gala 2024" time="2m ago" color="bg-green-500" />
                <ActivityItem user="Tech Conf" action="is full" target="" time="15m ago" color="bg-red-500" isSystem />
                <ActivityItem user="Mike Ross" action="joined waitlist" target="Workshop A" time="45m ago" color="bg-amber-500" />
                <ActivityItem user="David W." action="promoted from waitlist" target="Gala" time="1h ago" color="bg-indigo-500" />
            </div>
            <button className="mt-8 text-sm font-medium text-zinc-500 hover:text-white transition-colors">View all activity</button>
        </div>
      </div>

      {/* Top Events */}
      <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8">
        <h3 className="font-bold text-lg mb-8">{userRole === 'user' ? 'Trending Events' : 'Top Events'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TopEventItem name="NextGen Tech Solutions" registered={450} total={500} status="Selling Fast" />
            <TopEventItem name="Annual Charity Ball" registered={120} total={150} status="Steady" />
            <TopEventItem name="Deepmind Workshop" registered={24} total={30} status="Almost Full" />
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, trend, trendColor = "text-primary-500", icon }: { title: string, value: string, trend: string, trendColor?: string, icon: React.ReactNode }) {
  return (
    <div className="p-6 bg-zinc-950/50 border border-white/5 rounded-3xl hover:border-white/10 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-primary-600/10 group-hover:text-primary-500 transition-all">
          {icon}
        </div>
        <div className={`flex items-center text-xs font-bold ${trendColor}`}>
          {trend.startsWith('+') ? <ArrowUpRight size={14} className="mr-0.5" /> : <ArrowDownRight size={14} className="mr-0.5" />}
          {trend}
        </div>
      </div>
      <p className="text-sm font-medium text-zinc-500">{title}</p>
      <h4 className="text-2xl font-bold text-white mt-1 uppercase tracking-tight">{value}</h4>
    </div>
  );
}

function ActivityItem({ user, action, target, time, color }: any) {
    return (
        <div className="flex gap-4">
            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${color}`} />
            <div className="flex-1">
                <p className="text-sm text-zinc-300">
                    <span className="font-bold text-white">{user}</span> {action} {target && <span className="text-primary-500 font-medium">"{target}"</span>}
                </p>
                <p className="text-xs text-zinc-600 mt-1">{time}</p>
            </div>
        </div>
    );
}

function TopEventItem({ name, registered, total, status }: any) {
    const percentage = (registered / total) * 100;
    return (
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-sm leading-tight text-white">{name}</h4>
                <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-white/5 text-[10px] font-bold text-zinc-400">{status}</span>
            </div>
            <div className="space-y-3">
                <div className="flex justify-between text-xs text-zinc-500">
                    <span>{registered} / {total} seats</span>
                    <span>{Math.round(percentage)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
            </div>
        </div>
    );
}
