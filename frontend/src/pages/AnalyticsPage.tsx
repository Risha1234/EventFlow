import { 
  TrendingUp, 
  Clock, 
  MapPin,
  ArrowUpRight,
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const barData = [
  { name: 'SaaS Meetup', value: 100 },
  { name: 'AI Summit', value: 482 },
  { name: 'Design Workshop', value: 24 },
  { name: 'Dev Day', value: 120 },
];

const pieData = [
  { name: 'Organic', value: 400 },
  { name: 'Referral', value: 300 },
  { name: 'Social', value: 300 },
  { name: 'Direct', value: 200 },
];

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e'];

export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-zinc-500 mt-1">Deep insights into your event performance and audience.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 transition-all">
            Filter View <ChevronDown size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Conversion Rate" value="12.4%" change="+2.1%" icon={<TrendingUp />} />
        <StatCard title="Avg. Registration Time" value="4m 12s" change="-15s" icon={<Clock />} />
        <StatCard title="Top Region" value="North America" subValue="45% of total" icon={<MapPin />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8">
          <h3 className="font-bold text-lg mb-8">Registration Breakdown</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg">Traffic Sources</h3>
            <button className="text-zinc-500"><MoreHorizontal size={20} /></button>
          </div>
          <div className="h-80 flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {pieData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
                {pieData.map((item, i) => (
                    <div key={item.name} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                            <span className="text-sm text-zinc-400">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{item.value}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, subValue, icon }: any) {
    return (
        <div className="p-8 bg-zinc-950/50 border border-white/5 rounded-3xl">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 mb-6">
                {icon}
            </div>
            <p className="text-sm text-zinc-500 font-medium mb-1">{title}</p>
            <div className="flex items-baseline gap-3">
                <h4 className="text-2xl font-bold text-white">{value}</h4>
                {change && <span className="text-xs font-bold text-green-500 flex items-center"><ArrowUpRight size={12} className="mr-0.5" />{change}</span>}
                {subValue && <span className="text-xs text-zinc-600">{subValue}</span>}
            </div>
        </div>
    )
}
