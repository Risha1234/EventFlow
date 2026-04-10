import API_URL from "../utils/api";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Shield, Calendar, UserCheck, TrendingUp } from 'lucide-react';
import { Button, Badge } from '../components/ui';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Event {
  id: number;
  title: string;
  location: string;
  date: string;
  total_seats: number;
  available_seats: number;
  created_by: number;
}

interface Registration {
  id: number;
  user_id: number;
  event_id: number;
  status: string;
  registered_at: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'events' | 'registrations'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      // Fetch all admin data in parallel
      const [usersRes, eventsRes, regsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/events`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/registrations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!usersRes.ok || !eventsRes.ok || !regsRes.ok) {
        throw new Error('Failed to fetch admin data');
      }

      const usersData = await usersRes.json();
      const eventsData = await eventsRes.json();
      const regsData = await regsRes.json();

      setUsers(usersData);
      setEvents(eventsData);
      setRegistrations(regsData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    localStorage.removeItem('adminEmail');
    navigate('/');
  };

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'blue' },
    { label: 'Organizers', value: users.filter(u => u.role === 'organizer').length, icon: Shield, color: 'purple' },
    { label: 'Total Events', value: events.length, icon: Calendar, color: 'green' },
    { label: 'Total Registrations', value: registrations.length, icon: UserCheck, color: 'orange' }
  ];

  const confirmedCount = registrations.filter(r => r.status === 'confirmed').length;
  const waitlistCount = registrations.filter(r => r.status === 'waitlisted').length;

  // Transform data for charts
  const getRegistrationsTrendData = () => {
    const dateMap = new Map<string, number>();
    registrations.forEach(reg => {
      const date = new Date(reg.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });
    return Array.from(dateMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-14) // Last 14 days
      .map(([date, count]) => ({ date, registrations: count }));
  };

  const getEventFillRateData = () => {
    return events.map(event => ({
      name: event.title.substring(0, 15), // Truncate long titles
      fill: event.total_seats > 0 ? Math.round(((event.total_seats - event.available_seats) / event.total_seats) * 100) : 0
    }));
  };

  const getStatusDistributionData = () => {
    const cancelled = registrations.filter(r => r.status === 'cancelled').length;
    return [
      { name: 'Confirmed', value: confirmedCount },
      { name: 'Waitlisted', value: waitlistCount },
      { name: 'Cancelled', value: cancelled }
    ].filter(item => item.value > 0);
  };

  const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-zinc-500 mt-2">System management and analytics</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut size={18} /> Logout
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            const colorClasses = {
              blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
              purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
              green: 'bg-green-500/10 text-green-500 border-green-500/20',
              orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
            };
            return (
              <div key={idx} className={`${colorClasses[stat.color as keyof typeof colorClasses]} border rounded-2xl p-6`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </div>
                  <Icon size={24} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Registration Summary */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-zinc-500 mb-2">Confirmed</p>
            <p className="text-3xl font-bold text-green-500">{confirmedCount}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-zinc-500 mb-2">Waitlisted</p>
            <p className="text-3xl font-bold text-amber-500">{waitlistCount}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <p className="text-sm text-zinc-500 mb-2">Avg Fill Rate</p>
            <p className="text-3xl font-bold text-primary-500">
              {events.length > 0
                ? Math.round(
                    events.reduce((sum, e) => sum + (e.total_seats > 0 ? ((e.total_seats - e.available_seats) / e.total_seats * 100) : 0), 0) /
                      events.length
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        {/* Analytics Charts */}
        {!loading && registrations.length > 0 && (
          <div className="mb-12 space-y-6">
            <h2 className="text-2xl font-bold mb-6">Analytics Overview</h2>
            
            {/* Line Chart and Pie Chart Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Registrations Trend */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4">Registration Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getRegistrationsTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: 12 }} />
                    <YAxis stroke="#71717a" style={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      labelStyle={{ color: '#fafafa' }}
                    />
                    <Line type="monotone" dataKey="registrations" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Status Distribution Pie */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4">Registration Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getStatusDistributionData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getStatusDistributionData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      labelStyle={{ color: '#fafafa' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Event Fill Rate Bar Chart */}
            {events.length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Event Fill Rates</h3>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 80%+</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> 40-80%</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> {'<'}40%</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={getEventFillRateData()} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="fillGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="fillAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="fillRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" stroke="#52525b" style={{ fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" style={{ fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                      labelStyle={{ color: '#fafafa', fontWeight: 700, marginBottom: 4 }}
                      formatter={(value: number) => [`${value}%`, 'Fill Rate']}
                      cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                    />
                    <Bar dataKey="fill" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {getEventFillRateData().map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill >= 80 ? 'url(#fillGreen)' : entry.fill >= 40 ? 'url(#fillAmber)' : 'url(#fillRed)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: `Users (${users.length})` },
            { id: 'events', label: `Events (${events.length})` },
            { id: 'registrations', label: `Registrations (${registrations.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary-500 text-primary-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-500">Loading admin data...</p>
          </div>
        ) : (
          <>
            {/* Users Table */}
            {activeTab === 'users' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-zinc-800 bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm">{user.name}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400">{user.email}</td>
                          <td className="px-6 py-4 text-sm">
                            <Badge className={user.role === 'organizer' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Events Table */}
            {activeTab === 'events' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-zinc-800 bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Title</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Location</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Capacity</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Fill Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {events.map(event => {
                        const fillRate = event.total_seats > 0 ? ((event.total_seats - event.available_seats) / event.total_seats * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={event.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-4 text-sm">{event.title}</td>
                            <td className="px-6 py-4 text-sm text-zinc-400">
                              {new Date(event.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-400">{event.location}</td>
                            <td className="px-6 py-4 text-sm">
                              {event.total_seats - event.available_seats}/{event.total_seats}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <Badge className={fillRate > '80' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}>
                                {fillRate}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Registrations Table */}
            {activeTab === 'registrations' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-zinc-800 bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold">User ID</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Event ID</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {registrations.slice(0, 50).map(reg => (
                        <tr key={reg.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm">{reg.user_id}</td>
                          <td className="px-6 py-4 text-sm">{reg.event_id}</td>
                          <td className="px-6 py-4 text-sm">
                            <Badge className={reg.status === 'confirmed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}>
                              {reg.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">
                            {new Date(reg.registered_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {registrations.length > 50 && (
                  <div className="px-6 py-4 border-t border-zinc-800 text-sm text-zinc-500">
                    Showing 50 of {registrations.length} registrations
                  </div>
                )}
              </div>
            )}

            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Users size={20} /> Recent User Activity
                    </h3>
                    <p className="text-sm text-zinc-400 mb-4">Total users: {users.length}</p>
                    <p className="text-sm text-zinc-400">Organizers: {users.filter(u => u.role === 'organizer').length}</p>
                    <p className="text-sm text-zinc-400 mt-2">Regular users: {users.filter(u => u.role === 'user').length}</p>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <TrendingUp size={20} /> Event Statistics
                    </h3>
                    <p className="text-sm text-zinc-400 mb-4">Total events: {events.length}</p>
                    <p className="text-sm text-zinc-400">Total capacity: {events.reduce((sum, e) => sum + e.total_seats, 0)}</p>
                    <p className="text-sm text-zinc-400 mt-2">Registered: {confirmedCount + waitlistCount}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
